// ============================================================================
// CallStatusBadge — badge de statut d'appel avec spinner intégré
// ============================================================================
// Source unique du badge de statut (liste, accueil, détail). Affiche un petit
// spinner DANS le badge tant que l'appel n'est pas terminé (En attente,
// Transcription, Transcrit, Analyse) — le signal de chargement vit ainsi sur la
// ligne de l'appel, plus besoin d'un indicateur séparé. Présentation pure :
// l'animation est purement CSS (animate-spin), pas de JS.
// ============================================================================

import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IN_PROGRESS_STATUSES } from "@/lib/call-status";

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

export function CallStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  // « En cours » = tout sauf les états terminaux (analyzed / failed).
  const loading = (IN_PROGRESS_STATUSES as readonly string[]).includes(status);

  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "secondary"}
      className={cn("gap-1", className)}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : null}
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
