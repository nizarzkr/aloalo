// ============================================================================
// Edge Function Supabase — spend-alert
// ============================================================================
// Alerte de dépense IA QUOTIDIENNE (issue #20). Chaque transcription AssemblyAI
// et chaque analyse Claude écrit son coût estimé dans usage_logs.cost_eur, mais
// rien ne lisait jamais cette colonne. Ce job somme la dépense du jour (UTC) et,
// si elle dépasse un seuil, envoie UN email d'alerte via Resend. C'est un filet
// d'alerte PRÉCOCE : le vrai frein reste le plafond mensuel DUR configuré dans
// les dashboards Anthropic / AssemblyAI (cf. AGENTS.md → "Plafonds de dépense
// API"). Le code ne peut PAS garantir le plafond (cost_eur n'est qu'une ESTIMATION,
// cf. lib/claude.ts / lib/assemblyai.ts).
//
// READ-ONLY : ce job ne fait que LIRE usage_logs. Il n'y insère rien (la contrainte
// CHECK usage_logs.service n'autorise que assemblyai/anthropic/resend/stripe).
//
// Déploiement (action manuelle Nizar, pas pendant le dev) :
//   supabase functions deploy spend-alert --project-ref kynqancfanvekodbhukd
//   puis Dashboard Supabase → Database → Cron Jobs : créer une tâche QUOTIDIENNE
//   qui appelle https://kynqancfanvekodbhukd.supabase.co/functions/v1/spend-alert
//   avec l'header Authorization: Bearer <CRON_SECRET>.
//
// Secrets de la fonction (Supabase → Edge Functions → Secrets, PAS Vercel) :
//   CRON_SECRET            — partagé avec delete-old-audio (auth du cron).
//   SPEND_ALERT_DAILY_EUR  — seuil quotidien en € (défaut 10 si absent).
//   SPEND_ALERT_TO         — adresse ops qui reçoit l'alerte.
//   RESEND_API_KEY         — déjà présent (envoi d'email).
// ============================================================================

// @ts-expect-error — résolu côté Deno au runtime de l'Edge Function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Deno globals injectés par le runtime Supabase Edge Functions.
// Hors Deno (build Next.js, IDE), `Deno` n'existe pas — d'où le ts-expect-error.
// @ts-expect-error — Deno est fourni par le runtime de l'Edge Function.
declare const Deno: { env: { get(name: string): string | undefined }; serve: (handler: (req: Request) => Response | Promise<Response>) => void };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SPEND_ALERT_TO = Deno.env.get("SPEND_ALERT_TO");

// Seuil quotidien en euros. Défaut 10 si la var est absente ou non numérique.
function dailyThreshold(): number {
  const raw = Deno.env.get("SPEND_ALERT_DAILY_EUR");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

Deno.serve(async (req: Request) => {
  // 1. Auth : même garde que delete-old-audio. On accepte soit un CRON_SECRET
  //    dédié, soit (fallback) le Bearer <SERVICE_ROLE>. Vérifié AVANT toute
  //    requête DB : un appel sans header ne touche jamais la base.
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = CRON_SECRET
    ? `Bearer ${CRON_SECRET}`
    : `Bearer ${SERVICE_ROLE_KEY}`;
  if (authHeader !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 2. Somme de la dépense du jour (UTC). On lit cost_eur depuis minuit UTC.
  //    L'index idx_usage_logs_created_at rend ce filtre efficace.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: rows, error } = await supabase
    .from("usage_logs")
    .select("cost_eur")
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    console.error("[spend-alert] select error:", error);
    return new Response(
      JSON.stringify({ error: "select_failed", details: error.message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  // Somme en JS : le client REST Supabase n'expose pas sum() trivialement.
  const total = (rows ?? []).reduce(
    (s: number, r: { cost_eur: number | null }) => s + Number(r.cost_eur ?? 0),
    0,
  );
  const threshold = dailyThreshold();
  const dayLabel = startOfDay.toISOString().slice(0, 10);

  // 3. Sous le seuil : rien à signaler, on renvoie juste l'état.
  if (total < threshold) {
    console.log(
      `[spend-alert] ${dayLabel} : ${total.toFixed(2)} € < seuil ${threshold} € → pas d'alerte`,
    );
    return new Response(
      JSON.stringify({ success: true, total, threshold, alerted: false }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  // 4. Seuil atteint → un seul email d'alerte (le cron tourne 1×/jour, donc un
  //    envoi unique suffit). Un échec d'envoi ne fait PAS planter le monitoring :
  //    on log et on renvoie 200 avec alerted:false + alertError.
  let alerted = false;
  let alertError: string | undefined;

  if (!RESEND_API_KEY || !SPEND_ALERT_TO) {
    alertError = "RESEND_API_KEY ou SPEND_ALERT_TO absent — alerte non envoyée";
    console.error(`[spend-alert] ${alertError}`);
  } else {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          // Sender vérifié dans Resend (cf. app/api/invitations/route.ts).
          from: "Aloalo <noreply@pillarops.fr>",
          to: SPEND_ALERT_TO,
          subject: `⚠️ Aloalo — dépense IA du ${dayLabel} : ${total.toFixed(2)} €`,
          html:
            `<p>Alerte de dépense quotidienne Aloalo.</p>` +
            `<p>Dépense estimée du <strong>${dayLabel}</strong> (UTC) : ` +
            `<strong>${total.toFixed(2)} €</strong>, au-dessus du seuil de ` +
            `<strong>${threshold} €</strong>.</p>` +
            `<p>Rappel : ce montant est une ESTIMATION (cumul de usage_logs.cost_eur). ` +
            `Le vrai plafond est le cap mensuel dur configuré dans les dashboards ` +
            `Anthropic et AssemblyAI. Vérifie l'activité du jour si ce pic est inattendu.</p>`,
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        alertError = `Resend HTTP ${resp.status}: ${detail}`;
        console.error(`[spend-alert] ${alertError}`);
      } else {
        alerted = true;
        console.log(
          `[spend-alert] ✅ alerte envoyée à ${SPEND_ALERT_TO} (${total.toFixed(2)} € ≥ ${threshold} €)`,
        );
      }
    } catch (err) {
      alertError = err instanceof Error ? err.message : String(err);
      console.error("[spend-alert] resend send failed:", err);
    }
  }

  return new Response(
    JSON.stringify({ success: true, total, threshold, alerted, alertError }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
