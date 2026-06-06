import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileQuestion,
  ListChecks,
  UserX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/dashboard/empty-state";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { CopyButton } from "@/components/dashboard/copy-button";
import { HubspotRefreshButton } from "@/components/dashboard/hubspot-refresh-button";
import { ConversationDynamics } from "@/components/dashboard/conversation-dynamics";
import { CallTabs, type CallTab } from "@/components/dashboard/call-tabs";
import { CallSynthesis } from "@/components/dashboard/call-synthesis";
import { DimensionsEval } from "@/components/dashboard/dimensions-eval";
import {
  computeConversationMetrics,
  type ConversationMetrics,
} from "@/lib/metrics/conversation";
import type { DimensionEval } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — alignés sur le schéma Supabase et lib/claude.ts
// ---------------------------------------------------------------------------

type StrengthOrWeakness = {
  point: string;
  citation: string;
};

type CoachingAdvice = {
  advice: string;
  priority: "high" | "medium" | "low";
};

// Tâche de suivi proposée par l'IA, telle que stockée dans analyses.suggested_tasks.
type SuggestedTask = {
  title: string;
  due_date: string; // AAAA-MM-JJ
  reason: string;
};

type TranscriptSegment = {
  speaker: string;
  text: string;
  start: number; // ms
  end: number; // ms
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return "–";
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

// Formate une échéance de tâche (ISO datetime OU AAAA-MM-JJ) en date FR lisible.
function formatDueDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { dateStyle: "long" });
}

// "0:42" — minutes:secondes (utilisé pour les timestamps de segments).
function formatTimestamp(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Couleur de la barre de progression selon le score
function progressColor(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

// Garde défensive : les champs jsonb (strengths/weaknesses/coaching_advice)
// DEVRAIENT être des tableaux, mais une donnée malformée (vieille analyse, sortie
// IA inattendue) peut être une string/objet → `.map`/`.sort` planterait le rendu
// serveur entier. On normalise en tableau pour ne jamais casser la page.
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  transcribing: "Transcription",
  transcribed: "Transcrit",
  analyzing: "Analyse",
  analyzed: "Analysé",
  failed: "Échec",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  transcribing: "secondary",
  transcribed: "secondary",
  analyzing: "secondary",
  analyzed: "default",
  failed: "destructive",
};

// Priorité du coaching : high > medium > low
const PRIORITY_ORDER: Record<CoachingAdvice["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const PRIORITY_LABEL: Record<CoachingAdvice["priority"], string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

const PRIORITY_VARIANT: Record<
  CoachingAdvice["priority"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

const PRIORITY_DOT: Record<CoachingAdvice["priority"], string> = {
  high: "bg-red-500",
  medium: "bg-orange-500",
  low: "bg-muted-foreground/40",
};

const AXES: { key: string; label: string }[] = [
  { key: "score_discovery", label: "Découverte" },
  { key: "score_qualification", label: "Qualification" },
  { key: "score_closing", label: "Closing" },
  { key: "score_objection_handling", label: "Gestion des objections" },
  { key: "score_next_step", label: "Next step" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const orgId = profile?.organization_id;
  if (!orgId) notFound();

  // Portal HubSpot de l'org — sert à construire les liens vers la fiche contact
  // dans la section Synchro HubSpot (null si l'org n'a pas connecté HubSpot).
  const { data: org } = await supabase
    .from("organizations")
    .select("hubspot_portal_id")
    .eq("id", orgId)
    .single();
  const hubspotPortalId = (org?.hubspot_portal_id as string | null) ?? null;

  // L'embed `analyses(...)` ramène directement le résultat IA. Le filtre
  // organization_id verrouille l'accès cross-org même si le slug est connu.
  const { data: call } = await supabase
    .from("calls")
    .select(
      `
      id,
      contact_name,
      callee_number,
      company_name,
      deal_name,
      deal_id,
      hubspot_contact_id,
      started_at,
      created_at,
      duration_seconds,
      status,
      error_message,
      transcript_segments,
      hubspot_sync_status,
      analyses (
        score_global,
        score_discovery,
        score_qualification,
        score_objection_handling,
        score_closing,
        score_next_step,
        summary,
        strengths,
        weaknesses,
        coaching_advice,
        followup_points,
        suggested_tasks,
        conversation_metrics,
        dimensions,
        used_ai_profile
      )
    `,
    )
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!call) notFound();

  // L'embed FK 1-to-1 : objet ou tableau selon ce que PostgREST détecte.
  const analysisRel = call.analyses as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;
  const analysis = Array.isArray(analysisRel)
    ? analysisRel[0]
    : analysisRel;

  const status = call.status as string;
  const dateRef = call.started_at ?? call.created_at;
  const contactDisplay =
    call.contact_name ?? call.callee_number ?? "Appel sans contact";
  // Infos enrichies depuis HubSpot (null pour les appels non enrichis).
  const companyName = (call.company_name ?? null) as string | null;
  const dealName = (call.deal_name ?? null) as string | null;
  const dealId = (call.deal_id ?? null) as string | null;
  // Sous-titre « Entreprise · Deal » sous le nom du contact (parties présentes).
  const subtitleParts = [companyName, dealName].filter(Boolean) as string[];

  const segments = asArray<TranscriptSegment>(call.transcript_segments);

  // Métriques conversationnelles (J20). On privilégie la valeur PERSISTÉE
  // (calculée à l'analyse), avec un SECOURS de calcul à la volée depuis les
  // segments pour les appels analysés AVANT le J20 (colonne nulle) — évite tout
  // backfill. `null` reste possible si on n'a ni colonne ni segments.
  const storedMetrics = (analysis?.conversation_metrics ??
    null) as ConversationMetrics | null;
  const conversationMetrics: ConversationMetrics | null =
    storedMetrics ??
    (segments.length > 0 ? computeConversationMetrics(segments) : null);

  // États d'absence d'analyse — on les distingue pour donner un message clair.
  // USAGE_LIMIT_REACHED a déjà sa propre bannière (UpgradeBanner) au-dessus,
  // pas besoin de doubler.
  const errorMsg = (call.error_message ?? null) as string | null;
  const isUsageLimit = errorMsg?.includes("USAGE_LIMIT_REACHED") ?? false;
  const isFailedNonUsage = status === "failed" && !isUsageLimit;
  const isInProgress =
    status === "pending" ||
    status === "transcribing" ||
    status === "transcribed" ||
    status === "analyzing";
  const isAnalyzedButMissing = status === "analyzed" && !analysis;
  const showAnalysisStateBlock =
    isFailedNonUsage || isInProgress || isAnalyzedButMissing;

  const strengths = asArray<StrengthOrWeakness>(analysis?.strengths);
  const weaknesses = asArray<StrengthOrWeakness>(analysis?.weaknesses);
  const summary = (analysis?.summary ?? "") as string;
  // Flag persisté à l'insert dans /api/analyze. true → l'analyse a été
  // contextualisée par le profil IA de l'org au moment où elle a tourné.
  const usedAiProfile = Boolean(analysis?.used_ai_profile);
  const coaching = asArray<CoachingAdvice>(analysis?.coaching_advice)
    .slice()
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // Points à intégrer à l'email de suivi + tâches contextuelles, produits par
  // l'IA et stockés dans `analyses`. Vides ([]) pour les anciens appels.
  const followupPoints = asArray<string>(analysis?.followup_points);
  const suggestedTasks = asArray<SuggestedTask>(analysis?.suggested_tasks);

  // Synchro HubSpot (push réel). Présent uniquement sur les appels analysés
  // après le branchement de l'automatisation ; null pour les anciens appels.
  const sync = (call.hubspot_sync_status ?? null) as {
    status?: string;
    contact_id?: string;
    note_id?: string;
    target?: "deal" | "contact";
    deal_id?: string;
    deal_name?: string | null;
    company_name?: string | null;
    tasks?: Array<{
      title?: string;
      due_date?: string;
      reason?: string;
      task_id?: string | null;
      pushed?: boolean;
    }>;
  } | null;
  // On affiche la section dès qu'il y a quelque chose d'utile à montrer.
  const hasFollowupSection =
    followupPoints.length > 0 || suggestedTasks.length > 0 || Boolean(sync);

  // Tâches à afficher : si HubSpot a synchronisé, on montre les tâches RÉELLEMENT
  // créées (dates validées + statut de push) ; sinon les propositions de l'IA.
  const tasksToShow =
    sync?.tasks && sync.tasks.length > 0
      ? sync.tasks.map((t) => ({
          title: t.title ?? "",
          due_date: t.due_date ?? "",
          reason: t.reason ?? "",
          pushed: t.pushed,
        }))
      : suggestedTasks.map((t) => ({
          title: t.title,
          due_date: t.due_date,
          reason: t.reason,
          pushed: undefined as boolean | undefined,
        }));
  // Lien direct vers la fiche contact HubSpot (objet contact = 0-1).
  const contactId = call.hubspot_contact_id ?? sync?.contact_id ?? null;
  const contactUrl =
    hubspotPortalId && contactId
      ? `https://app.hubspot.com/contacts/${hubspotPortalId}/record/0-1/${contactId}`
      : null;
  // Lien direct vers la fiche deal HubSpot (objet deal = 0-3).
  const dealUrl =
    hubspotPortalId && dealId
      ? `https://app.hubspot.com/contacts/${hubspotPortalId}/record/0-3/${dealId}`
      : null;

  // --- Scoring factuel par dimensions (J21) -------------------------------
  // [] pour les analyses antérieures au J21 → l'onglet Évaluation retombe sur
  // l'ancien affichage chiffré (repli legacy ci-dessous).
  const dimensions = asArray<DimensionEval>(analysis?.dimensions);
  const hasMissedDimension = dimensions.some((d) => d.status === "manqué");

  // Nombre de signaux conversationnels (J20) à surveiller — alimente la barre
  // de synthèse et la pastille de l'onglet Dynamique.
  const signalsCount = conversationMetrics
    ? Object.values(conversationMetrics.flags).filter(Boolean).length
    : 0;

  // Prochaine action mise en avant dans la synthèse : la 1re tâche suggérée.
  const nextAction = suggestedTasks[0]?.title ?? null;

  // --- Contenus des onglets (rendus côté serveur, passés à CallTabs) ------

  // Évaluation : dimensions factuelles, ou repli chiffré pour les vieux appels.
  const evaluationContent =
    dimensions.length > 0 ? (
      <DimensionsEval dimensions={dimensions} />
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AXES.map(({ key, label }) => {
          const score = analysis?.[key] as number | null | undefined;
          const value = typeof score === "number" ? score : 0;
          return (
            <Card key={key} size="sm">
              <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {typeof score === "number" ? `${score}/100` : "–"}
                  </span>
                </div>
                <Progress value={value} indicatorClassName={progressColor(value)} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    );

  // Coaching : points forts, axes d'amélioration, conseils (le résumé est
  // désormais dans la barre de synthèse, plus ici).
  const coachingContent = (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Points forts</CardTitle>
          </CardHeader>
          <CardContent>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun point fort identifié.
              </p>
            ) : (
              <ul className="space-y-3">
                {strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-green-500"
                    />
                    <div>
                      <p className="font-medium text-foreground">{s.point}</p>
                      {s.citation ? (
                        <p className="mt-0.5 text-xs text-muted-foreground italic">
                          « {s.citation} »
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Axes d&apos;amélioration</CardTitle>
          </CardHeader>
          <CardContent>
            {weaknesses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun axe d&apos;amélioration identifié.
              </p>
            ) : (
              <ul className="space-y-3">
                {weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-orange-500"
                    />
                    <div>
                      <p className="font-medium text-foreground">{w.point}</p>
                      {w.citation ? (
                        <p className="mt-0.5 text-xs text-muted-foreground italic">
                          « {w.citation} »
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {coaching.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conseils de coaching</CardTitle>
            <CardDescription>
              Triés par priorité — à appliquer sur les prochains appels.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {coaching.map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      PRIORITY_DOT[c.priority],
                    )}
                  />
                  <p className="flex-1 text-sm leading-relaxed text-foreground">
                    {c.advice}
                  </p>
                  <Badge variant={PRIORITY_VARIANT[c.priority]} className="shrink-0">
                    {PRIORITY_LABEL[c.priority]}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  // Suivi : synchro HubSpot + points email + tâches (ex-« Prochaines étapes »).
  const suiviContent = (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex justify-end">
          <HubspotRefreshButton callId={call.id as string} />
        </div>

        {sync?.status === "synced" ? (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" aria-hidden />
              Synchronisé avec HubSpot
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>{sync.note_id ? "✓" : "—"} Note de synthèse</li>
              <li>
                {sync.tasks?.filter((t) => t.pushed).length ?? 0} tâche(s) de
                suivi créée(s)
              </li>
              {sync.target ? (
                <li>
                  Rattaché au{" "}
                  {sync.target === "deal"
                    ? `deal${dealName ? ` « ${dealName} »` : ""}`
                    : "contact"}
                </li>
              ) : null}
            </ul>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {dealUrl ? (
                <a
                  href={dealUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Ouvrir le deal dans HubSpot
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
              {contactUrl ? (
                <a
                  href={contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Ouvrir la fiche contact dans HubSpot
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        ) : sync?.status === "no_contact" ? (
          <p className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">
            <UserX className="size-4 shrink-0" aria-hidden />
            Aucun contact HubSpot trouvé pour ce numéro — les points et tâches
            ci-dessous restent disponibles ici.
          </p>
        ) : sync?.status === "skipped" ? (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            HubSpot n&apos;est pas connecté.{" "}
            <Link
              href="/dashboard/settings/integrations"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Connecter HubSpot
            </Link>{" "}
            pour pousser automatiquement note de synthèse et tâches de suivi.
          </p>
        ) : null}

        {followupPoints.length > 0 ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ListChecks className="size-4 text-muted-foreground" aria-hidden />
                À intégrer dans votre email de suivi
              </p>
              <CopyButton
                value={followupPoints.map((p) => `• ${p}`).join("\n")}
                label="Copier"
              />
            </div>
            <ul className="space-y-1.5 text-sm text-foreground">
              {followupPoints.map((point, i) => (
                <li key={i} className="flex gap-2">
                  <span className="select-none text-muted-foreground">•</span>
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tasksToShow.length > 0 ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
              Tâches de suivi proposées
            </p>
            <ul className="space-y-3">
              {tasksToShow.map((task, i) => (
                <li key={i} className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {task.title}
                    </p>
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <CalendarClock className="size-3" aria-hidden />
                      {formatDueDate(task.due_date)}
                    </Badge>
                  </div>
                  {task.reason ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {task.reason}
                    </p>
                  ) : null}
                  {task.pushed === false ? (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Non créée dans HubSpot (réessayez plus tard).
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  // Transcription : toujours disponible (preuve brute).
  const transcriptionContent = (
    <Card>
      <CardContent>
        {segments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Transcription en cours…
          </p>
        ) : (
          <ul className="space-y-3">
            {segments.map((seg, i) => {
              const isCommercial = seg.speaker === "A";
              return (
                <li
                  key={i}
                  className={cn(
                    "flex flex-col gap-1",
                    isCommercial ? "items-start" : "items-end",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-baseline gap-2 text-xs",
                      isCommercial ? "" : "flex-row-reverse",
                    )}
                  >
                    <span className="font-medium text-foreground">
                      {isCommercial ? "Commercial" : "Prospect"}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatTimestamp(seg.start)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "max-w-[90%] rounded-2xl px-3 py-2 text-sm md:max-w-[80%]",
                      isCommercial
                        ? "bg-mint text-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {seg.text}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  // Assemblage des onglets selon ce qui est disponible. Ordre = pyramide
  // inversée : évaluation → dynamique → coaching → suivi → transcription.
  const isAnalyzed = status === "analyzed" && Boolean(analysis);
  const tabs: CallTab[] = [];
  if (isAnalyzed) {
    tabs.push({
      id: "evaluation",
      label: "Évaluation",
      alert: hasMissedDimension,
      content: evaluationContent,
    });
  }
  if (conversationMetrics && conversationMetrics.total_talk_ms > 0) {
    tabs.push({
      id: "dynamique",
      label: "Dynamique",
      alert: signalsCount > 0,
      content: <ConversationDynamics metrics={conversationMetrics} />,
    });
  }
  if (isAnalyzed) {
    tabs.push({ id: "coaching", label: "Coaching", content: coachingContent });
  }
  if (isAnalyzed && hasFollowupSection) {
    tabs.push({ id: "suivi", label: "Suivi", content: suiviContent });
  }
  tabs.push({
    id: "transcription",
    label: "Transcription",
    content: transcriptionContent,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      {/* Bouton retour */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour aux appels
      </Link>

      {/* Bannière paywall : visible uniquement si error_message contient USAGE_LIMIT_REACHED */}
      <UpgradeBanner errorMessage={call.error_message as string | null} />

      {/* Header appel */}
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {contactDisplay}
          </h1>
          {/* Entreprise · Deal (depuis HubSpot) — affiché seulement si enrichi. */}
          {subtitleParts.length > 0 ? (
            <p className="mt-0.5 text-sm font-medium text-foreground/80">
              {subtitleParts.join(" · ")}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(dateRef).toLocaleString("fr-FR", {
              dateStyle: "long",
              timeStyle: "short",
            })}
            {call.duration_seconds
              ? ` · ${formatDuration(call.duration_seconds)}`
              : ""}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </header>

      {/* État de l'analyse — affiché si l'appel n'a pas encore d'analyse exploitable */}
      {showAnalysisStateBlock ? (
        <section className="mb-10">
          <Card className="p-2">
            <CardContent>
              {isFailedNonUsage ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="L'analyse a échoué"
                  description={
                    errorMsg ??
                    "L'analyse n'a pas pu aboutir. Réessayez plus tard ou contactez le support."
                  }
                />
              ) : isAnalyzedButMissing ? (
                <EmptyState
                  icon={FileQuestion}
                  title="Analyse introuvable"
                  description="L'analyse de cet appel n'a pas pu être chargée. Réessayez dans un instant."
                />
              ) : (
                <EmptyState
                  icon={Clock}
                  title="Analyse en cours"
                  description="Votre appel est en cours de traitement (transcription puis analyse IA). Le résultat apparaîtra ici dans quelques instants — actualisez la page."
                />
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Synthèse (toujours visible) — uniquement si l'appel est analysé. */}
      {isAnalyzed ? (
        <CallSynthesis
          summary={summary}
          dimensions={dimensions}
          signalsCount={signalsCount}
          usedAiProfile={usedAiProfile}
          nextAction={nextAction}
        />
      ) : null}

      {/* Détail en onglets — pyramide inversée (évaluation → … → transcription). */}
      <CallTabs tabs={tabs} />
    </div>
  );
}
