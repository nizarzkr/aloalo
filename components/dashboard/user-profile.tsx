"use client";

// ============================================================================
// UserProfile — fiche commercial : header + KPI + courbe + 10 derniers appels
// ============================================================================

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
};

type Call = {
  id: string;
  callee_number: string | null;
  contact_name: string | null;
  company_name: string | null;
  deal_name: string | null;
  started_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  status: string;
  score_global: number | null;
};

type Props = {
  profile: Profile;
  calls: Call[]; // chronologique ascendant, max 30
  analyzedCount: number;
  avgScore: number | null;
  totalDurationSeconds: number;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  sales: "Commercial·e",
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  sales: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
};

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

function getInitials(profile: Profile) {
  const name = profile.full_name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return profile.email.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) return "–";
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

type ChartDatum = { date: string; score: number };

// recharts injecte les props au runtime via cloneElement → toutes optionnelles
// côté types pour pouvoir passer <ChartTooltip /> à Tooltip.content.
function ChartTooltip({
  active,
  payload,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1 text-xs shadow-md">
      Score : {value}/100
    </div>
  );
}

export function UserProfile({
  profile,
  calls,
  analyzedCount,
  avgScore,
  totalDurationSeconds,
}: Props) {
  const displayName = profile.full_name?.trim() || profile.email;
  const initials = getInitials(profile);

  // Courbe : on garde les calls qui ont vraiment un score.
  const chartData: ChartDatum[] = calls
    .filter((c) => typeof c.score_global === "number")
    .map((c) => ({
      date: formatShortDate(c.started_at ?? c.created_at),
      score: c.score_global as number,
    }));

  // Tableau : 10 plus récents (calls est ASC pour le chart, on retourne et coupe).
  const recentCalls = [...calls].reverse().slice(0, 10);

  const kpis = [
    { label: "Appels analysés", value: String(analyzedCount) },
    { label: "Score moyen", value: avgScore !== null ? `${avgScore}%` : "–" },
    { label: "Durée totale", value: formatDuration(totalDurationSeconds) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <Avatar size="lg" className="size-14">
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-500 text-base font-semibold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-2xl font-bold tracking-tight">
            {displayName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate">{profile.email}</span>
            <span>·</span>
            <Badge
              variant="secondary"
              className={cn("border-0", ROLE_BADGE[profile.role] ?? ROLE_BADGE.sales)}
            >
              {ROLE_LABEL[profile.role] ?? profile.role}
            </Badge>
            <span>·</span>
            <span>Membre depuis le {formatDate(profile.created_at)}</span>
          </div>
        </div>
      </header>

      {/* KPI */}
      <section className="grid gap-4 sm:grid-cols-3">
        {kpis.map(({ label, value }) => (
          <Card key={label} className="p-2">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl font-bold tracking-tight">
                {value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* Progression */}
      <section className="mt-8">
        <Card className="p-2">
          <CardHeader>
            <CardTitle>Progression des scores</CardTitle>
            <CardDescription>
              {chartData.length >= 2
                ? `Évolution sur les ${chartData.length} derniers appels analysés.`
                : "Pas assez de données pour le moment."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length < 2 ? (
              <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                Pas assez d&apos;appels pour afficher la progression.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="currentColor"
                    className="text-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#6366f1" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Derniers appels */}
      <section className="mt-8">
        <Card className="p-2">
          <CardHeader>
            <CardTitle>Derniers appels</CardTitle>
            <CardDescription>
              {recentCalls.length === 0
                ? "Aucun appel analysé pour ce commercial."
                : `Les ${recentCalls.length} appels analysés les plus récents.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {recentCalls.length === 0 ? (
              <div className="px-6 pb-4 text-sm text-muted-foreground">
                Quand des appels seront analysés, ils apparaîtront ici.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentCalls.map((call) => {
                  const dateRef = call.started_at ?? call.created_at;
                  return (
                    <li key={call.id}>
                      <Link
                        href={`/dashboard/calls/${call.id}`}
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {call.contact_name ??
                              call.callee_number ??
                              "Appel sans contact"}
                          </p>
                          {/* Entreprise · Deal (HubSpot) si l'appel est enrichi. */}
                          {[call.company_name, call.deal_name].filter(Boolean)
                            .length > 0 ? (
                            <p className="truncate text-xs font-medium text-muted-foreground">
                              {[call.company_name, call.deal_name]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {new Date(dateRef).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
                          {call.duration_seconds
                            ? formatDuration(call.duration_seconds)
                            : "–"}
                        </span>
                        <span className="min-w-10 text-right text-sm font-semibold tabular-nums">
                          {call.score_global !== null
                            ? `${call.score_global}%`
                            : "–"}
                        </span>
                        <Badge
                          variant={STATUS_VARIANT[call.status] ?? "secondary"}
                        >
                          {STATUS_LABEL[call.status] ?? call.status}
                        </Badge>
                      </Link>
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
