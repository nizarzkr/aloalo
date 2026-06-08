import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, PhoneCall, Play } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CallsFilterBar } from "@/components/dashboard/calls-filter-bar";
import { CallStatusBadge } from "@/components/dashboard/call-status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListAutoRefresh } from "@/components/dashboard/list-auto-refresh";
import { revalidateCallsList } from "@/app/dashboard/calls/actions";
import { createClient } from "@/lib/supabase/server";
import { buildSignature, IN_PROGRESS_STATUSES } from "@/lib/call-status";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

// Lundi 00:00 (timezone serveur). getDay : 0 = dimanche, 1 = lundi…
function startOfCurrentWeek(now: Date) {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 1er du mois courant à 00:00 (timezone serveur).
function startOfCurrentMonth(now: Date) {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) return "–";
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

type CallsSearchParams = {
  period?: string;
  score?: string;
  page?: string;
};

export default async function CallsListPage({
  searchParams,
}: {
  searchParams: Promise<CallsSearchParams>;
}) {
  const { period, score, page } = await searchParams;

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

  const orgId = profile?.organization_id ?? null;
  // Défense en profondeur : la RLS scope déjà sur l'org, mais on filtre
  // explicitement au cas où le profil n'aurait pas (encore) d'org.
  const orgFilter = orgId ?? "00000000-0000-0000-0000-000000000000";

  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Filtre temporel : "week" = lundi 00:00, "month" = 1er du mois.
  let dateFrom: string | null = null;
  if (period === "week") {
    dateFrom = startOfCurrentWeek(new Date()).toISOString();
  } else if (period === "month") {
    dateFrom = startOfCurrentMonth(new Date()).toISOString();
  }

  // Filtre score : on bascule l'embed analyses en !inner pour que le
  // .gte/.lt sur la table embarquée filtre vraiment les calls retournés.
  // Sans !inner, l'embed est optionnel et le filtre ne réduit pas la liste.
  const isGood = score === "good";
  const isLow = score === "low";
  const analysesEmbed =
    isGood || isLow
      ? "analyses!inner ( score_global )"
      : "analyses ( score_global )";

  let query = supabase
    .from("calls")
    .select(
      `id, callee_number, contact_name, company_name, deal_name, deal_id, started_at, created_at, duration_seconds, status, ${analysesEmbed}`,
      { count: "exact" },
    )
    .eq("organization_id", orgFilter)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }
  if (isGood) {
    query = query.gte("analyses.score_global", 70);
  } else if (isLow) {
    query = query.lt("analyses.score_global", 50);
  }

  const { data: callsData, count } = await query;
  const calls = callsData ?? [];
  const totalCount = count ?? 0;

  // Appels en cours de l'org (toutes pages) → signature pour le suivi live.
  // La liste se rafraîchit seule tant qu'au moins un appel n'est pas terminé.
  const { data: inProgressData } = await supabase
    .from("calls")
    .select("id, status")
    .eq("organization_id", orgFilter)
    .in("status", [...IN_PROGRESS_STATUSES]);
  const inProgressRows = (inProgressData ?? []) as Array<{
    id: string;
    status: string;
  }>;
  const liveSignature = buildSignature(inProgressRows);
  const liveActive = inProgressRows.length > 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Regroupement « deal » (J23) : on compte les appels par prospect pour ne
  // proposer le lien vers la trajectoire que quand il y a ≥ 2 appels. Clé =
  // deal_id HubSpot si présent, sinon le numéro appelé (cas des appels simulés).
  const { data: groupRows } = await supabase
    .from("calls")
    .select("callee_number, deal_id")
    .eq("organization_id", orgFilter);
  const groupCount = new Map<string, number>();
  for (const row of groupRows ?? []) {
    const key = row.deal_id
      ? `deal:${row.deal_id}`
      : row.callee_number
        ? `phone:${row.callee_number}`
        : null;
    if (key) groupCount.set(key, (groupCount.get(key) ?? 0) + 1);
  }

  // Construit l'URL d'une autre page en conservant les filtres actifs.
  function buildPageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (period && period !== "all") params.set("period", period);
    if (score && score !== "all") params.set("score", score);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/dashboard/calls?${qs}` : "/dashboard/calls";
  }

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  // Distinction empty state global vs "filtre sans résultat" : on regarde
  // l'état des filtres tel qu'envoyé en query string (et non `count`, qui est
  // toujours filtré).
  const hasActiveFilters =
    (period && period !== "all") || (score && score !== "all");
  const isInitiallyEmpty = totalCount === 0 && !hasActiveFilters;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Appels
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalCount} appel{totalCount > 1 ? "s" : ""} au total
        </p>
      </header>

      {/* Moteur de rafraîchissement automatique (invisible) : met à jour les
          badges tant qu'un appel est en cours. Le signal vit dans les badges. */}
      <ListAutoRefresh
        signature={liveSignature}
        active={liveActive}
        onRevalidate={revalidateCallsList}
      />

      <div className="mb-6">
        <CallsFilterBar />
      </div>

      <Card className="p-2">
        {calls.length === 0 ? (
          <CardContent className="py-4">
            {isInitiallyEmpty ? (
              <EmptyState
                icon={PhoneCall}
                title="Aucun appel analysé"
                description="Vos appels Ringover apparaîtront ici une fois analysés. Vous pouvez simuler un appel pour découvrir la plateforme."
                action={
                  <Link
                    href="/dev/test"
                    className={cn(buttonVariants({ size: "lg" }))}
                  >
                    <Play className="size-4" />
                    Simuler un appel
                  </Link>
                }
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun appel ne correspond à ces filtres.
              </p>
            )}
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Liste des appels</CardTitle>
              <CardDescription>
                Page {currentPage} sur {totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border">
                {calls.map((call) => {
                  // L'embed FK 1-to-1 peut renvoyer objet ou tableau.
                  const analysisRel = call.analyses as
                    | { score_global: number | null }
                    | { score_global: number | null }[]
                    | null;
                  const analysis = Array.isArray(analysisRel)
                    ? analysisRel[0]
                    : analysisRel;
                  const scoreValue = analysis?.score_global ?? null;
                  const dateRef = call.started_at ?? call.created_at;
                  const status = call.status as string;

                  // Clé de regroupement deal (même logique que groupCount).
                  const groupKey = call.deal_id
                    ? `deal:${call.deal_id}`
                    : call.callee_number
                      ? `phone:${call.callee_number}`
                      : null;
                  const groupTotal = groupKey
                    ? (groupCount.get(groupKey) ?? 0)
                    : 0;
                  const hasTrajectory = Boolean(groupKey) && groupTotal >= 2;

                  return (
                    <li key={call.id} className="flex items-stretch">
                      <Link
                        href={`/dashboard/calls/${call.id}`}
                        className="grid flex-1 grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
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
                          {scoreValue !== null ? `${scoreValue}%` : "–"}
                        </span>
                        <CallStatusBadge status={status} />
                      </Link>
                      {/* Lien vers la trajectoire du deal (sibling, pas imbriqué)
                          — affiché uniquement si le prospect a ≥ 2 appels. */}
                      {hasTrajectory && groupKey ? (
                        <Link
                          href={`/dashboard/deals/${encodeURIComponent(groupKey)}`}
                          className="flex items-center gap-1 border-l border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                          title="Voir la trajectoire de ce deal"
                        >
                          <Activity className="size-3.5" />
                          <span className="hidden sm:inline">{groupTotal} appels</span>
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </>
        )}
      </Card>

      {totalPages > 1 ? (
        <nav
          className="mt-6 flex items-center justify-between"
          aria-label="Pagination"
        >
          {hasPrevious ? (
            <Link
              href={buildPageHref(currentPage - 1)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Précédent
            </Link>
          ) : (
            <span
              aria-disabled
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "pointer-events-none opacity-50",
              )}
            >
              Précédent
            </span>
          )}

          <span className="text-sm text-muted-foreground">
            Page {currentPage} / {totalPages}
          </span>

          {hasNext ? (
            <Link
              href={buildPageHref(currentPage + 1)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Suivant
            </Link>
          ) : (
            <span
              aria-disabled
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "pointer-events-none opacity-50",
              )}
            >
              Suivant
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
