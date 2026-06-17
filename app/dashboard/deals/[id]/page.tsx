// ============================================================================
// /dashboard/deals/[id] — Trajectoire (« momentum ») d'un deal (J23)
// ============================================================================
// Vue AGRÉGÉE (pas de table `deals`) : on regroupe à la volée les appels d'un
// même prospect et on en lit la trajectoire d'engagement appel après appel
// (signaux in-call J20 + J22), enrichie des signaux CRM HubSpot si disponibles.
//
// Le param [id] encode la clé de regroupement :
//   - `deal:<hubspotDealId>` quand les appels sont rattachés à un deal HubSpot ;
//   - `phone:<callee_number>` sinon (cas des appels simulés / sans CRM).
// ============================================================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, PhoneCall, TrendingDown, TrendingUp } from "lucide-react";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { decryptSecret } from "@/lib/crypto/org-secrets";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  computeDealMomentum,
  type DealCallPoint,
  type DealCrmSignals,
  type MomentumTrend,
} from "@/lib/metrics/momentum";
import type { ConversationMetrics } from "@/lib/metrics/conversation";
import type { BehavioralSignals } from "@/lib/claude";
import { getContactEmailSignals } from "@/lib/hubspot";
import { buildAlertForDeal } from "@/lib/metrics/coaching-alert";
import {
  hasPushedCoachingAction,
  getPushedHygieneActions,
} from "@/lib/deals/pushed-actions";
import { getDealHygiene } from "@/lib/hygiene/compute";
import { PushHubspotActionButton } from "@/components/dashboard/push-hubspot-action-button";
import { DealHygienePanel } from "@/components/dashboard/deal-hygiene-panel";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// L'embed FK 1-to-1 peut renvoyer un objet ou un tableau selon le contexte.
type AnalysisRel = {
  conversation_metrics: ConversationMetrics | null;
  behavioral_signals: BehavioralSignals | null;
} | null;

type CallRow = {
  id: string;
  callee_number: string | null;
  contact_name: string | null;
  company_name: string | null;
  deal_name: string | null;
  deal_id: string | null;
  hubspot_contact_id: string | null;
  status: string;
  started_at: string | null;
  created_at: string;
  analyses: AnalysisRel | AnalysisRel[];
};

function pickAnalysis(rel: AnalysisRel | AnalysisRel[]): AnalysisRel {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// Couleur d'un engagement 0-100 (mêmes paliers que partout : menthe / jaune / rouge).
function engagementTone(value: number | null): string {
  if (value == null) return "bg-muted";
  if (value >= 66) return "bg-mint";
  if (value >= 40) return "bg-yellow";
  return "bg-red-400";
}

const TREND_META: Record<
  MomentumTrend,
  { label: string; className: string }
> = {
  hausse: { label: "Engagement en hausse", className: "bg-mint text-foreground" },
  baisse: { label: "Engagement en baisse", className: "bg-red-100 text-red-700" },
  stable: { label: "Engagement stable", className: "bg-muted text-foreground" },
  indéterminé: { label: "Trajectoire indéterminée", className: "bg-muted text-muted-foreground" },
};

export default async function DealMomentumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);

  // Parse de la clé de regroupement.
  const isDeal = decoded.startsWith("deal:");
  const isPhone = decoded.startsWith("phone:");
  if (!isDeal && !isPhone) notFound();
  const groupValue = decoded.slice(decoded.indexOf(":") + 1);
  if (!groupValue) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  const orgFilter =
    profile?.organization_id ?? "00000000-0000-0000-0000-000000000000";

  // Appels du prospect (RLS scope déjà sur l'org ; on filtre en plus par sûreté).
  let query = supabase
    .from("calls")
    .select(
      `id, callee_number, contact_name, company_name, deal_name, deal_id, hubspot_contact_id, status, started_at, created_at,
       analyses ( conversation_metrics, behavioral_signals )`,
    )
    .eq("organization_id", orgFilter)
    .order("created_at", { ascending: true });

  query = isDeal
    ? query.eq("deal_id", groupValue)
    : query.eq("callee_number", groupValue);

  const { data: callsData } = await query;
  const calls = (callsData ?? []) as CallRow[];
  if (calls.length === 0) notFound();

  // En-tête prospect : on prend la 1re valeur non nulle rencontrée.
  const contactName =
    calls.find((c) => c.contact_name)?.contact_name ?? null;
  const companyName = calls.find((c) => c.company_name)?.company_name ?? null;
  const dealName = calls.find((c) => c.deal_name)?.deal_name ?? null;
  const phone = calls.find((c) => c.callee_number)?.callee_number ?? groupValue;
  const hubspotContactId =
    calls.find((c) => c.hubspot_contact_id)?.hubspot_contact_id ?? null;

  // Contacts distincts du deal (un deal peut croiser plusieurs interlocuteurs :
  // champion + décideur). Sert à visualiser le multi-threading.
  const distinctContacts = [
    ...new Set(
      calls.map((c) => c.contact_name).filter((n): n is string => Boolean(n)),
    ),
  ];

  // Points de trajectoire (déjà triés chronologiquement par la requête).
  const points: DealCallPoint[] = calls.map((c) => {
    const a = pickAnalysis(c.analyses);
    return {
      call_id: c.id,
      date: c.started_at ?? c.created_at,
      conversation_metrics: a?.conversation_metrics ?? null,
      behavioral_signals: a?.behavioral_signals ?? null,
    };
  });

  // Signaux CRM (off-call) — uniquement si HubSpot connecté + contact connu.
  // Dégrade silencieusement vers null (cas dominant sur données simulées).
  let crm: DealCrmSignals | null = null;
  if (hubspotContactId) {
    // hubspot_token n'est plus lisible côté RLS (issue #5) : lecture admin
    // (clé secrète, bypass RLS) scopée sur l'org, puis déchiffrement.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: org } = await admin
      .from("organizations")
      .select("hubspot_token")
      .eq("id", orgFilter)
      .maybeSingle();
    const token = decryptSecret((org?.hubspot_token as string | null) ?? null);
    if (token) {
      crm = await getContactEmailSignals(hubspotContactId, token);
    }
  }

  const momentum = computeDealMomentum(points, crm);
  const trendMeta = TREND_META[momentum.trend];

  // Alerte coaching de CE deal (non null si décrochage) + état « déjà poussé »
  // dans HubSpot (J26) → conditionne l'affichage du bouton d'action.
  const alert = buildAlertForDeal(
    {
      group_key: decoded,
      contact_name: contactName,
      company_name: companyName,
      deal_name: dealName,
      owner_name: null,
      calls_count: calls.length,
    },
    momentum,
  );
  const alreadyPushed = alert
    ? await hasPushedCoachingAction(orgFilter, decoded)
    : false;

  // Hygiène du deal (J30) + corrections déjà poussées (J31).
  const [hygieneReport, pushedHygieneKeys] = await Promise.all([
    getDealHygiene(orgFilter, decoded),
    getPushedHygieneActions(orgFilter),
  ]);

  const callById = new Map(calls.map((c) => [c.id, c]));
  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <Link
        href="/dashboard/calls"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour aux appels
      </Link>

      {/* En-tête prospect */}
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Trajectoire du deal
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground">
          {dealName ?? contactName ?? companyName ?? phone}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[companyName].filter(Boolean).join(" · ") || phone}
          {" · "}
          {calls.length} appel{calls.length > 1 ? "s" : ""}
        </p>
        {distinctContacts.length > 1 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Contacts impliqués :
            </span>{" "}
            {distinctContacts.join(", ")}
          </p>
        ) : null}
      </header>

      {/* Bandeau trajectoire : tendance + raisons en clair */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-5 text-muted-foreground" aria-hidden />
            Momentum
          </CardTitle>
          <Badge className={cn("gap-1.5", trendMeta.className)}>
            {momentum.trend === "baisse" ? (
              <TrendingDown className="size-3.5" aria-hidden />
            ) : momentum.trend === "hausse" ? (
              <TrendingUp className="size-3.5" aria-hidden />
            ) : null}
            {trendMeta.label}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mini-courbe d'engagement (barres par appel) */}
          <div>
            <div className="flex items-end gap-2" aria-hidden>
              {momentum.points.map((p) => {
                const h =
                  p.engagement == null ? 8 : Math.max(8, (p.engagement / 100) * 96);
                return (
                  <div key={p.call_id} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn("w-full rounded-t-sm", engagementTone(p.engagement))}
                      style={{ height: `${h}px` }}
                    />
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {p.engagement ?? "–"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Indice d&apos;engagement par appel (signaux du prospect : questions
              d&apos;achat, fermeté du next step, temps de parole). Indicatif, pas une
              note.
            </p>
          </div>

          {/* Raisons en clair */}
          {momentum.reasons.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                {momentum.trend === "baisse"
                  ? "Pourquoi le deal décroche"
                  : "Lecture de la trajectoire"}
              </p>
              <ul className="space-y-1.5">
                {momentum.reasons.map((r, i) => (
                  <li key={`${r.code}-${i}`} className="flex gap-2 text-sm text-muted-foreground">
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        momentum.trend === "baisse" ? "bg-red-400" : "bg-mint",
                      )}
                    />
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Action 1:1 actionnable (J26) — uniquement si le deal décroche. */}
          {alert ? (
            <div className="rounded-md bg-red-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                Action recommandée
              </p>
              <p className="mb-3 text-sm text-foreground">{alert.action}</p>
              <PushHubspotActionButton
                groupKey={decoded}
                alreadyPushed={alreadyPushed}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Hygiène du deal (J31) : écarts dit/CRM + correction 1 clic. */}
      <DealHygienePanel
        groupKey={decoded}
        report={hygieneReport}
        pushedKeys={pushedHygieneKeys}
      />

      {/* Momentum CRM (off-call) — affiché seulement si HubSpot a des données */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Signaux CRM (hors appel)</CardTitle>
        </CardHeader>
        <CardContent>
          {crm ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <CrmStat
                label="Délai de réponse"
                value={
                  crm.velocity_hours != null
                    ? `${Math.round(crm.velocity_hours)} h`
                    : "–"
                }
              />
              <CrmStat
                label="Interlocuteurs"
                value={crm.multi_threading != null ? String(crm.multi_threading) : "–"}
              />
              <CrmStat
                label="Ouvertures email"
                value={crm.total_opens != null ? String(crm.total_opens) : "n/d"}
              />
              <CrmStat
                label="Clics email"
                value={crm.total_clicks != null ? String(crm.total_clicks) : "n/d"}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun signal CRM disponible pour ce prospect (pas d&apos;email loggué
              dans HubSpot, ou intégration non connectée). Les appels simulés
              n&apos;en génèrent pas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timeline des appels */}
      <section>
        <h2 className="mb-4 font-heading text-lg font-semibold tracking-tight text-foreground">
          Historique des appels
        </h2>
        <Card className="p-2">
          <ul className="divide-y divide-border">
            {/* Plus récent en haut dans la timeline. */}
            {[...momentum.points].reverse().map((p, idx) => {
              const call = callById.get(p.call_id);
              const num = momentum.points.length - idx;
              return (
                <li key={p.call_id}>
                  <Link
                    href={`/dashboard/calls/${p.call_id}`}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs tabular-nums text-muted-foreground">
                      {num}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {call?.contact_name ?? dateFmt(p.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call?.contact_name ? `${dateFmt(p.date)} · ` : ""}
                        {p.buying_signals != null
                          ? `${p.buying_signals} signal${p.buying_signals > 1 ? "aux" : ""} d'achat`
                          : "—"}
                        {p.next_step_firmness
                          ? ` · next step ${p.next_step_firmness}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">
                        {p.engagement ?? "–"}
                      </span>
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          engagementTone(p.engagement),
                        )}
                        aria-hidden
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        {calls.some((c) => c.status !== "analyzed") ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <PhoneCall className="size-3.5" />
            Certains appels ne sont pas encore analysés — la trajectoire
            s&apos;affinera une fois leur analyse terminée.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function CrmStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
