// ============================================================================
// DealHygieneBadge (J31) — pastille « N écart(s) » d'hygiène de pipeline.
// ============================================================================
// Présentational pur (pas de state) : se pose sur la carte deal et la liste
// « Deals à surveiller » de l'accueil. Couleur = sévérité la plus haute des
// écarts. Volontairement compact (glanceable), il complète l'alerte de
// décrochage sans la dupliquer.
// ============================================================================

import { ShieldAlert } from "lucide-react";

import type { HygieneSeverity } from "@/lib/hygiene/types";
import { cn } from "@/lib/utils";

// Mêmes paliers de couleur que le reste du pilotage (rouge / jaune / neutre).
const SEVERITY_STYLE: Record<HygieneSeverity, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow/40 text-foreground",
  low: "bg-muted text-muted-foreground",
};

export function DealHygieneBadge({
  count,
  severity,
  className,
}: {
  count: number;
  severity: HygieneSeverity | null;
  className?: string;
}) {
  if (count <= 0 || severity === null) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        SEVERITY_STYLE[severity],
        className,
      )}
      title="Écarts d'hygiène de pipeline détectés"
    >
      <ShieldAlert className="size-3" aria-hidden />
      {count} écart{count > 1 ? "s" : ""}
    </span>
  );
}
