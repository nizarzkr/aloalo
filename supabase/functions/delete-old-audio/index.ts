// ============================================================================
// Edge Function Supabase — delete-old-audio
// ============================================================================
// Cron RGPD : à exécuter toutes les heures (planifié via le scheduler Supabase).
// Logique : pour tout call dont audio_url est non null et créé il y a plus de
// 24h, on remet audio_url à NULL. On ne stocke pas l'audio brut nous-mêmes —
// c'est Ringover (ou Aircall) qui l'héberge selon ses propres durées de
// rétention — donc effacer notre référence suffit côté Aloalo.
//
// En mode simulation (provider='simulated'), audio_url est déjà null dès la
// création, donc ce cron est sans effet sur les appels de test. Il vise les
// vrais appels Ringover (J3+).
//
// Déploiement (à faire à J12, pas maintenant) :
//   supabase functions deploy delete-old-audio --project-ref kynqancfanvekodbhukd
//   puis depuis le dashboard Supabase → Database → Cron Jobs, créer une tâche
//   horaire qui appelle https://<ref>.supabase.co/functions/v1/delete-old-audio
//   avec l'header Authorization: Bearer <CRON_SECRET>.
//
// Note schéma : usage_logs.service est contraint à
// ('assemblyai','anthropic','resend','stripe'). Pas de catégorie "system" pour
// cet event. On utilise service='assemblyai' (la source de l'audio_url upload
// AssemblyAI) + operation='audio_deleted' et on stocke le détail en metadata.
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

Deno.serve(async (req: Request) => {
  // 1. Auth : on accepte soit le header cron Supabase (Bearer <SERVICE_ROLE>),
  //    soit un CRON_SECRET dédié si on veut isoler l'appelant.
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

  // 2. Fenêtre 24h : on récupère tous les calls dont l'audio doit être purgé.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: calls, error: selectError } = await supabase
    .from("calls")
    .select("id, organization_id")
    .not("audio_url", "is", null)
    .lt("created_at", cutoff);

  if (selectError) {
    console.error("[delete-old-audio] select error:", selectError);
    return new Response(
      JSON.stringify({ error: "select_failed", details: selectError.message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  if (!calls || calls.length === 0) {
    return new Response(
      JSON.stringify({ success: true, purged: 0 }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  // 3. Update en masse : on null l'audio_url de tous les calls détectés.
  //    L'audio brut reste chez Ringover/Aircall, on coupe juste notre référence.
  const ids = calls.map((c: { id: string }) => c.id);
  const { error: updateError } = await supabase
    .from("calls")
    .update({ audio_url: null })
    .in("id", ids);

  if (updateError) {
    console.error("[delete-old-audio] update error:", updateError);
    return new Response(
      JSON.stringify({ error: "update_failed", details: updateError.message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  // 4. Log d'audit dans usage_logs — un row par call pour pouvoir reconstituer
  //    l'historique RGPD si jamais on doit prouver l'effacement effectif.
  const logRows = calls.map(
    (c: { id: string; organization_id: string }) => ({
      organization_id: c.organization_id,
      call_id: c.id,
      service: "assemblyai" as const, // contrainte CHECK du schéma usage_logs
      operation: "audio_deleted",
      units: 1,
      cost_eur: 0,
      metadata: { reason: "rgpd_24h_cleanup", cutoff },
    }),
  );

  const { error: logError } = await supabase
    .from("usage_logs")
    .insert(logRows);

  if (logError) {
    // On n'échoue pas la fonction pour autant : l'effacement a eu lieu, c'est
    // le log d'audit qui rate. On signale juste dans la réponse.
    console.error("[delete-old-audio] log insert error:", logError);
  }

  console.log(
    `[delete-old-audio] ✅ purgé ${calls.length} audio_url (cutoff ${cutoff})`,
  );

  return new Response(
    JSON.stringify({
      success: true,
      purged: calls.length,
      logged: !logError,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
