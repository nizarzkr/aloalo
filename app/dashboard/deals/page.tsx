// ============================================================================
// /dashboard/deals — Liste des deals (J24bis)
// ============================================================================
// Page de pilotage : tous les deals (prospects avec ≥ 1 appel), chacun avec sa
// tendance d'engagement et une ALERTE sur la carte quand il décroche. Tri par
// risque (défaut) ou activité récente ; filtres recherche / risque / commercial.
// Clic sur une carte → /dashboard/deals/[id] (trajectoire détaillée).
// ============================================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DealsFilterBar,
  type OwnerOption,
} from "@/components/dashboard/deals-filter-bar";
import { createClient } from "@/lib/supabase/server";
import { aggregateOrgDeals, type DealSummary } from "@/lib/deals/aggregate";
import { severityRank } from "@/lib/metrics/coaching-alert";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type DealsSearchParams = {
  q?: string;
  risk?: string;
  owner?: string;
  sort?: string;
};

// Couleur d'un indice d'engagement 0-100 (mêmes paliers que la page trajectoire).
function engagementTone(value: number | null): string {
  if (value == null) return "bg-muted";
  if (value >= 66) return "bg-mint";
  if (value >= 40) return "bg-yellow";
  return "bg-red-400";
}

function dealTitle(d: DealSummary): string {
  return (
    [d.contact_name, d.company_name].filter(Boolean).join(" · ") ||
    d.deal_name ||
    d.group_key.replace(/^phone:/, "")
  );
}

export default async function DealsListPage({
  searchParams,
}: {
  searchParams: Promise<DealsSearchParams>;
}) {
  const { q, risk, owner, sort } = await searchParams;

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
  if (!profile?.organization_id) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <p className="text-sm text-muted-foreground">
          Impossible de charger votre organisation.
        </p>
      </div>
    );
  }

  const allDeals = await aggregateOrgDeals(profile.organization_id);

  // Options du filtre commercial = propriétaires distincts présents dans les deals.
  const ownerMap = new Map<string, string>();
  for (const d of allDeals) {
    if (d.owner_id && d.owner_name) ownerMap.set(d.owner_id, d.owner_name);
  }
  const owners: OwnerOption[] = [...ownerMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ---- Filtres ----
  const query = (q ?? "").trim().toLowerCase();
  let deals = allDeals;
  if (query) {
    deals = deals.filter((d) =>
      [d.contact_name, d.company_name, d.deal_name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(query)),
    );
  }
  if (risk === "risk") {
    deals = deals.filter((d) => d.alert != null);
  }
  if (owner && owner !== "all") {
    deals = deals.filter((d) => d.owner_id === owner);
  }

  // ---- Tri ----
  const sortMode = sort === "recent" ? "recent" : "risk";
  deals = [...deals].sort((a, b) => {
    if (sortMode === "risk") {
      const r = severityRank(a.alert) - severityRank(b.alert);
      if (r !== 0) return r;
      // À sévérité égale, engagement final le plus bas en tête.
      const ea = a.momentum.last_engagement ?? 100;
      const eb = b.momentum.last_engagement ?? 100;
      if (ea !== eb) return ea - eb;
    }
    // Repli / mode récent : activité la plus récente d'abord.
    return Date.parse(b.last_activity) - Date.parse(a.last_activity);
  });

  const atRiskCount = allDeals.filter((d) => d.alert != null).length;
  const hasAnyDeal = allDeals.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Deals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {allDeals.length} deal{allDeals.length > 1 ? "s" : ""}
          {atRiskCount > 0 ? (
            <>
              {" · "}
              <span className="font-medium text-red-600">
                {atRiskCount} à risque
              </span>
            </>
          ) : null}
        </p>
      </header>

      {!hasAnyDeal ? (
        <Card className="p-2">
          <CardContent className="py-4">
            <EmptyState
              icon={Briefcase}
              title="Aucun deal pour l'instant"
              description="Chaque prospect que vous appelez apparaîtra ici avec sa trajectoire d'engagement. Simulez ou importez des appels pour commencer."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6">
            <DealsFilterBar owners={owners} />
          </div>

          {deals.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aucun deal ne correspond à ces filtres.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {deals.map((d) => (
                <li key={d.group_key}>
                  <DealCard deal={d} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function DealCard({ deal }: { deal: DealSummary }) {
  const { momentum, alert } = deal;
  const trend = momentum.trend;

  return (
    <Link
      href={`/dashboard/deals/${encodeURIComponent(deal.group_key)}`}
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40",
        alert?.severity === "haute"
          ? "border-red-300"
          : alert
            ? "border-yellow"
            : "border-border",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {dealTitle(deal)}
          </p>
          <p className="text-xs text-muted-foreground">
            {deal.owner_name ? `${deal.owner_name} · ` : ""}
            {deal.calls_count} appel{deal.calls_count > 1 ? "s" : ""}
          </p>
        </div>
        <Badge
          className={cn(
            "shrink-0",
            deal.status === "actif"
              ? "bg-muted text-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {deal.status === "actif" ? "Actif" : "Dormant"}
        </Badge>
      </div>

      {/* Mini-tendance d'engagement (barres) */}
      <div className="mb-3 flex items-end gap-1" aria-hidden>
        {momentum.points.map((p) => {
          const h = p.engagement == null ? 6 : Math.max(6, (p.engagement / 100) * 40);
          return (
            <div
              key={p.call_id}
              className={cn("flex-1 rounded-t-sm", engagementTone(p.engagement))}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>

      {/* Alerte sur la carte si décrochage, sinon état de tendance neutre */}
      {alert ? (
        <div className="mt-auto rounded-md bg-red-50 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <TrendingDown className="size-3.5 text-red-600" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide text-red-700">
              {alert.severity === "haute" ? "Risque élevé" : "À surveiller"}
            </span>
          </div>
          <p className="text-sm text-foreground">{alert.action}</p>
        </div>
      ) : (
        <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {trend === "hausse" ? (
            <>
              <TrendingUp className="size-3.5 text-emerald-600" />
              Engagement en hausse
            </>
          ) : trend === "stable" ? (
            "Engagement stable"
          ) : (
            "Pas encore de trajectoire (un seul appel)"
          )}
        </p>
      )}
    </Link>
  );
}
