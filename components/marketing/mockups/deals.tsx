// ============================================================================
// Réplique — vue Deals (/dashboard/deals)
// ============================================================================
// Reprend les cartes de deal réelles : badge de statut, barres de trajectoire
// d'engagement, écart d'hygiène de pipeline, alerte de décrochage avec l'action
// proposée. Le tri « risque d'abord » est ce qui fait la valeur : les deals qui
// se refroidissent remontent tout seuls.
// ============================================================================

import { AlertTriangle, TrendingDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { Frame } from "./frame";

type Deal = {
  title: string;
  meta: string;
  status: "actif" | "dormant" | "gagné";
  statusClass: string;
  /** Engagement par appel (0–100, null = pas de mesure). */
  points: (number | null)[];
  hygiene?: string;
  alert?: { level: string; stage: string; action: string };
  trend?: string;
};

// Même échelle de couleur que `engagementTone()` dans la page réelle.
function tone(value: number | null) {
  if (value == null) return "bg-muted";
  if (value >= 66) return "bg-mint";
  if (value >= 40) return "bg-yellow";
  return "bg-red-400";
}

const DEALS: Deal[] = [
  {
    title: "Helios — Refonte du parc",
    meta: "Léa Fabre · 3 appels",
    status: "dormant",
    statusClass: "bg-muted text-muted-foreground",
    points: [78, 61, 34],
    alert: {
      level: "Risque élevé",
      stage: "Négociation",
      action:
        "L'interlocuteur n'a pas confirmé le budget sur les 2 derniers appels. Proposer un point avec le décideur financier cette semaine.",
    },
  },
  {
    title: "Acme Corp — Déploiement Q3",
    meta: "Nizar Z. · 4 appels",
    status: "actif",
    statusClass: "bg-muted text-foreground",
    points: [52, 64, 71, 83],
    hygiene: "2 écarts",
    trend: "Engagement en hausse",
  },
];

export function DealsMockup({ className }: { className?: string }) {
  return (
    <Frame
      label="aloalo.app / pipeline"
      activeItem="Pipeline"
      className={className}
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-heading text-base font-medium">Pipeline</p>
          <span className="rounded-md bg-card px-2 py-1 font-mono text-[10px] tracking-[-0.03em] text-muted-foreground ring-1 ring-foreground/10">
            Tri : risque d&apos;abord
          </span>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {DEALS.map((deal) => (
            <li
              key={deal.title}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-3",
                deal.alert ? "border-red-300" : "border-border",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {deal.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {deal.meta}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className={deal.statusClass}>
                    {deal.status[0].toUpperCase() + deal.status.slice(1)}
                  </Badge>
                  {deal.hygiene ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow/30 px-2 py-0.5 text-[10px] font-medium text-foreground">
                      <AlertTriangle className="size-2.5" />
                      {deal.hygiene}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Trajectoire d'engagement, un bâton par appel */}
              <div className="mb-2.5 flex items-end gap-1">
                {deal.points.map((point, i) => (
                  <div
                    key={i}
                    className={cn("flex-1 rounded-t-sm", tone(point))}
                    style={{
                      height: `${point == null ? 6 : Math.max(6, (point / 100) * 34)}px`,
                    }}
                  />
                ))}
              </div>

              {deal.alert ? (
                <div className="mt-auto rounded-md bg-red-50 p-2.5">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <TrendingDown className="size-3 text-red-600" />
                    <span className="text-[10px] font-semibold tracking-wide text-red-700 uppercase">
                      {deal.alert.level}
                    </span>
                    <span className="text-[10px] text-red-700/80">
                      · {deal.alert.stage}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-foreground">
                    {deal.alert.action}
                  </p>
                </div>
              ) : (
                <p className="mt-auto text-[11px] text-muted-foreground">
                  {deal.trend}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}
