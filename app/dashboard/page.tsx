import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

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
import { revalidateDashboardHome } from "@/app/dashboard/calls/actions";
import { createClient } from "@/lib/supabase/server";
import { buildSignature, IN_PROGRESS_STATUSES } from "@/lib/call-status";
import { aggregateOrgDeals } from "@/lib/deals/aggregate";
import { cn } from "@/lib/utils";

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
    .select("full_name, organization_id")
    .eq("id", user.id)
    .single();

  const fullName = profile?.full_name ?? "";
  const firstName = fullName.trim().split(/\s+/)[0] || "";
  const orgId = profile?.organization_id ?? null;

  // Bornes temporelles pour les KPI
  const now = new Date();
  const weekStartIso = startOfCurrentWeek(now).toISOString();

  // RLS scope déjà à l'org du JWT, mais on filtre explicitement par défense
  // en profondeur — et pour court-circuiter si l'org n'est pas encore connue.
  const orgFilter = orgId ?? "00000000-0000-0000-0000-000000000000";

  const [
    weekCallsRes,
    dealsAtRisk,
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
