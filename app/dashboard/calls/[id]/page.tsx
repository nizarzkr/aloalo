import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock, FileQuestion } from "lucide-react";

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

  // L'embed `analyses(...)` ramène directement le résultat IA. Le filtre
  // organization_id verrouille l'accès cross-org même si le slug est connu.
  const { data: call } = await supabase
    .from("calls")
    .select(
      `
      id,
      contact_name,
      callee_number,
      started_at,
      created_at,
      duration_seconds,
      status,
      error_message,
      transcript_segments,
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
        coaching_advice
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

  const segments = (call.transcript_segments ?? null) as
    | TranscriptSegment[]
    | null;

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

  const strengths = (analysis?.strengths ?? []) as StrengthOrWeakness[];
  const weaknesses = (analysis?.weaknesses ?? []) as StrengthOrWeakness[];
  const summary = (analysis?.summary ?? "") as string;
  const scoreGlobal = analysis?.score_global as number | null | undefined;
  const coaching = ((analysis?.coaching_advice ?? []) as CoachingAdvice[])
    .slice()
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {contactDisplay}
          </h1>
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

      {/* Scores — uniquement si l'appel est analysé */}
      {status === "analyzed" && analysis ? (
        <section className="mb-10 grid gap-6">
          {/* Score global */}
          <Card>
            <CardHeader>
              <CardDescription>Score global</CardDescription>
              <CardTitle className="text-4xl font-bold tabular-nums tracking-tight md:text-5xl">
                {scoreGlobal ?? "–"}
                <span className="ml-1 text-xl font-medium text-muted-foreground md:text-2xl">
                  /100
                </span>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Sous-scores par axe */}
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
                    <Progress
                      value={value}
                      indicatorClassName={progressColor(value)}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Points forts + Axes d'amélioration */}
      {status === "analyzed" && analysis ? (
        <section className="mb-10 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Points forts</CardTitle>
            </CardHeader>
            <CardContent>
              {strengths.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun point fort identifié.</p>
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
                <p className="text-sm text-muted-foreground">Aucun axe d&apos;amélioration identifié.</p>
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
        </section>
      ) : null}

      {/* Conseils de coaching */}
      {status === "analyzed" && coaching.length > 0 ? (
        <section className="mb-10">
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
                    <Badge
                      variant={PRIORITY_VARIANT[c.priority]}
                      className="shrink-0"
                    >
                      {PRIORITY_LABEL[c.priority]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Résumé de l'appel */}
      {status === "analyzed" && summary ? (
        <section className="mb-10">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Résumé de l&apos;appel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">{summary}</p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Transcript */}
      <section className="mb-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcript</CardTitle>
            <CardDescription>
              Conversation diarisée par AssemblyAI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!segments || segments.length === 0 ? (
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
                            ? "bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-50"
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
      </section>
    </div>
  );
}
