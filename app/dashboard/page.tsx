import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings, TrendingDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CallStatusBadge } from "@/components/dashboard/call-status-badge";
import { DimensionsDots } from "@/components/dashboard/dimensions-dots";
import { ListAutoRefresh } from "@/components/dashboard/list-auto-refresh";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import {
  SalesHome,
  type SalesCall,
  type SalesNextTask,
} from "@/components/dashboard/sales-home";
import { revalidateDashboardHome } from "@/app/dashboard/calls/actions";
import { Badge } from "@/components/ui/badge";
import { DealHygieneBadge } from "@/components/dashboard/deal-hygiene-badge";
import { createClient } from "@/lib/supabase/server";
import { buildSignature, IN_PROGRESS_STATUSES } from "@/lib/call-status";
import { aggregateOrgDeals, type DealSummary } from "@/lib/deals/aggregate";
import { severityRank } from "@/lib/metrics/coaching-alert";
import { getOrgHygiene } from "@/lib/hygiene/compute";
import { topSeverity } from "@/lib/hygiene/rules";
import type { HygieneSeverity } from "@/lib/hygiene/types";
import { getOnboardingState, ONBOARDING_STEPS } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type HygieneSummary = { count: number; severity: HygieneSeverity | null };

// Titre lisible d'un deal (même logique que /dashboard/deals).
function dealTitle(d: DealSummary): string {
  return (
    d.deal_name ||
    [d.company_name, d.contact_name].filter(Boolean).join(" · ") ||
    d.group_key.replace(/^phone:/, "")
  );
}

// Début de la semaine en cours (lundi 00:00 dans la timezone du serveur).
// JS getDay : 0 = dimanche, 1 = lundi… on aligne sur lundi.
function startOfCurrentWeek(now: Date) {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Durée en secondes → "Xh Ymin" / "Ymin" / "–" si 0.
function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) return "–";
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id")
    .eq("id", user.id)
    .single();

  const fullName = profile?.full_name ?? "";
  const firstName = fullName.trim().split(/\s+/)[0] || "";
  const orgId = profile?.organization_id ?? null;
  const orgFilter = orgId ?? "00000000-0000-0000-0000-000000000000";

  // --- Home COMMERCIALE (sales) : vue personnelle et bienveillante (J34) ----
  // Centrée sur SON travail (pas d'org-level, pas de cadran « risque »). On lit
  // ses derniers appels + les suggested_tasks déjà produites par l'IA.
  if (profile?.role === "sales") {
    const [myCallsRes, myInProgressRes] = await Promise.all([
      supabase
        .from("calls")
        .select(
          "id, started_at, created_at, duration_seconds, status, contact_name, callee_number, company_name, deal_name, analyses ( dimensions, suggested_tasks )",
        )
        .eq("organization_id", orgFilter)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("calls")
        .select("id, status")
        .eq("organization_id", orgFilter)
        .eq("user_id", user.id)
        .in("status", [...IN_PROGRESS_STATUSES]),
    ]);

    const myCalls = myCallsRes.data ?? [];

    // Normalise l'embed FK 1-to-1 (objet ou tableau selon le client).
    const analysisOf = (rel: unknown) =>
      (Array.isArray(rel) ? rel[0] : rel) as
        | { dimensions: unknown; suggested_tasks: unknown }
        | undefined;

    const calls: SalesCall[] = myCalls.map((c) => {
      const a = analysisOf(c.analyses);
      const subtitle =
        [c.company_name, c.deal_name].filter(Boolean).join(" · ") || null;
      return {
        id: c.id,
        contactLabel: c.contact_name ?? c.callee_number ?? "Appel sans contact",
        subtitle,
        dateRef: c.started_at ?? c.created_at,
        durationSeconds: c.duration_seconds,
        status: c.status as string,
        dimensions: a?.dimensions ?? null,
      };
    });

    // Aplatit les tâches suggérées de tous ses appels, triées par échéance.
    const nextTasks: SalesNextTask[] = myCalls
      .flatMap((c) => {
        const a = analysisOf(c.analyses);
        const tasks = Array.isArray(a?.suggested_tasks)
          ? (a.suggested_tasks as Array<{ title?: string; due_date?: string }>)
          : [];
        const contactLabel =
          c.contact_name ?? c.callee_number ?? "Appel sans contact";
        return tasks
          .filter((t) => typeof t?.title === "string" && t.title.trim())
          .map((t) => ({
            title: t.title as string,
            dueDate: typeof t.due_date === "string" ? t.due_date : null,
            callId: c.id,
            contactLabel,
          }));
      })
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
      .slice(0, 5);

    const myInProgress = (myInProgressRes.data ?? []) as Array<{
      id: string;
      status: string;
    }>;

    return (
      <SalesHome
        firstName={firstName}
        nextTasks={nextTasks}
        calls={calls}
        liveSignature={buildSignature(myInProgress)}
        liveActive={myInProgress.length > 0}
      />
    );
  }

  // Bandeau de reprise d'onboarding (J29) : visible uniquement pour un owner qui
  // a « passé pour l'instant » (sinon le layout l'aurait redirigé vers
  // /onboarding). Disparaît une fois l'onboarding terminé.
  const onboarding =
    profile?.role === "owner" && orgId
      ? await getOnboardingState(orgId)
      : null;
  const showOnboardingBanner = onboarding != null && !onboarding.completedAt;

  // Bornes temporelles pour les KPI
  const now = new Date();
  const weekStartIso = startOfCurrentWeek(now).toISOString();

  // RLS scope déjà à l'org du JWT, mais `orgFilter` (défini plus haut) filtre
  // aussi explicitement par défense en profondeur.

  const [
    weekCallsRes,
    dealsAtRisk,
    hygieneReports,
    durationsRes,
    latestCallsRes,
    inProgressRes,
  ] = await Promise.all([
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgFilter)
      .eq("status", "analyzed")
      .gte("created_at", weekStartIso),
    // Deals à risque (J25) : on réutilise l'agrégation des deals et on compte
    // ceux qui décrochent (alerte coaching non nulle). Remplace le « score moyen ».
    orgId ? aggregateOrgDeals(orgId) : Promise.resolve([]),
    // Rapports d'hygiène (J30/J31) → liste « Deals à surveiller » actionnable.
    orgId ? getOrgHygiene(orgId) : Promise.resolve([]),
    supabase
      .from("calls")
      .select("duration_seconds")
      .eq("organization_id", orgFilter)
      .eq("status", "analyzed"),
    supabase
      .from("calls")
      .select(
        "id, started_at, created_at, duration_seconds, status, contact_name, callee_number, company_name, deal_name, analyses ( dimensions )",
      )
      .eq("organization_id", orgFilter)
      .order("created_at", { ascending: false })
      .limit(5),
    // Appels en cours (toutes pages) → signature pour le suivi live des badges.
    supabase
      .from("calls")
      .select("id, status")
      .eq("organization_id", orgFilter)
      .in("status", [...IN_PROGRESS_STATUSES]),
  ]);

  const inProgressRows = (inProgressRes.data ?? []) as Array<{
    id: string;
    status: string;
  }>;
  const liveSignature = buildSignature(inProgressRows);
  const liveActive = inProgressRows.length > 0;

  const weekCount = weekCallsRes.count ?? 0;

  // Deals à risque = deals avec une alerte de décrochage (cf. aggregateOrgDeals).
  const atRiskCount = dealsAtRisk.filter((d) => d.alert !== null).length;

  // Résumé d'hygiène par deal (nb d'écarts + sévérité max) pour la watchlist.
  const hygieneByKey = new Map<string, HygieneSummary>();
  for (const r of hygieneReports) {
    if (r.gaps.length > 0) {
      hygieneByKey.set(r.group_key, {
        count: r.gaps.length,
        severity: topSeverity(r.gaps),
      });
    }
  }

  // « Deals à surveiller » = décrochage (alerte) OU écarts d'hygiène. Priorisés :
  // sévérité d'alerte, puis présence d'écarts, puis engagement le plus bas.
  const watchlist = dealsAtRisk
    .filter((d) => d.alert !== null || hygieneByKey.has(d.group_key))
    .sort((a, b) => {
      const r = severityRank(a.alert) - severityRank(b.alert);
      if (r !== 0) return r;
      const ha = hygieneByKey.has(a.group_key) ? 0 : 1;
      const hb = hygieneByKey.has(b.group_key) ? 0 : 1;
      if (ha !== hb) return ha - hb;
      return (
        (a.momentum.last_engagement ?? 100) - (b.momentum.last_engagement ?? 100)
      );
    })
    .slice(0, 5);

  const totalSeconds = (durationsRes.data ?? []).reduce(
    (sum, c) => sum + (c.duration_seconds ?? 0),
    0,
  );

  const latestCalls = latestCallsRes.data ?? [];

  const kpis = [
    {
      label: "Appels cette semaine",
      value: String(weekCount),
    },
    {
      label: "Deals à risque",
      value: String(atRiskCount),
    },
    {
      label: "Durée totale analysée",
      value: formatDuration(totalSeconds),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {firstName ? `Bienvenue, ${firstName}` : "Bienvenue"}
        </h1>
      </header>

      {showOnboardingBanner ? (
        <OnboardingBanner
          doneCount={onboarding.doneCount}
          totalSteps={ONBOARDING_STEPS.length}
        />
      ) : null}

      {/* Moteur de rafraîchissement automatique (invisible) : met à jour les
          badges des derniers appels tant qu'un appel est en cours. */}
      <ListAutoRefresh
        signature={liveSignature}
        active={liveActive}
        onRevalidate={revalidateDashboardHome}
      />

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

      {watchlist.length > 0 ? (
        <section className="mt-10">
          <Card className="p-2">
            <CardHeader>
              <CardTitle>Deals à surveiller</CardTitle>
              <CardDescription>
                Deals qui décrochent ou dont le CRM s&apos;écarte de la réalité
                des appels.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border">
                {watchlist.map((d) => {
                  const hygiene = hygieneByKey.get(d.group_key) ?? null;
                  return (
                    <li key={d.group_key}>
                      <Link
                        href={`/dashboard/deals/${encodeURIComponent(d.group_key)}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {dealTitle(d)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {d.owner_name ? `${d.owner_name} · ` : ""}
                            {d.calls_count} appel{d.calls_count > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {d.alert ? (
                            <Badge
                              className={cn(
                                "gap-1",
                                d.alert.severity === "haute"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow/40 text-foreground",
                              )}
                            >
                              <TrendingDown className="size-3" aria-hidden />
                              {d.alert.severity === "haute"
                                ? "Risque élevé"
                                : "À surveiller"}
                            </Badge>
                          ) : null}
                          {hygiene ? (
                            <DealHygieneBadge
                              count={hygiene.count}
                              severity={hygiene.severity}
                            />
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="mt-10">
        {latestCalls.length === 0 ? (
          <Card className="p-2">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                Aucun appel pour l&apos;instant. Connectez votre téléphonie pour
                commencer à analyser vos performances.
              </p>
              <Link
                href="/dashboard/settings"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                <Settings className="size-4" />
                Aller dans Paramètres
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-2">
            <CardHeader>
              <CardTitle>Derniers appels</CardTitle>
              <CardDescription>Les 5 appels les plus récents.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border">
                {latestCalls.map((call) => {
                  // L'embed Supabase d'une FK 1-to-1 peut renvoyer objet ou tableau
                  const analysisRel = call.analyses as
                    | { dimensions: unknown }
                    | { dimensions: unknown }[]
                    | null;
                  const analysis = Array.isArray(analysisRel)
                    ? analysisRel[0]
                    : analysisRel;
                  const dateRef = call.started_at ?? call.created_at;
                  const status = call.status as string;

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
                        <span className="justify-self-end">
                          <DimensionsDots dimensions={analysis?.dimensions} />
                        </span>
                        <CallStatusBadge status={status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
