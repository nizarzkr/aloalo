// ============================================================================
// CallSynthesis — barre de synthèse en tête de la page d'appel (J21)
// ============================================================================
// Répond en un coup d'œil, AVANT les onglets : « ça s'est bien passé ? ».
// Remonte le résumé de l'appel, l'état des dimensions (chips colorées) et le
// nombre de signaux faibles à surveiller. Toujours visible, jamais replié.
// ============================================================================

import Link from "next/link";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DIMENSION_META,
  DIMENSION_ORDER,
  STATUS_META,
} from "@/components/dashboard/dimensions-eval";
import type { DimensionEval } from "@/lib/claude";

function safeStatus(status: unknown) {
  return status === "validé" || status === "partiel" || status === "manqué"
    ? status
    : "partiel";
}

export function CallSynthesis({
  summary,
  dimensions,
  signalsCount,
  usedAiProfile,
  nextAction,
}: {
  summary: string;
  dimensions: DimensionEval[];
  signalsCount: number;
  usedAiProfile: boolean;
  nextAction?: string | null;
}) {
  const byKey = new Map(dimensions.map((d) => [d.key, d]));
  const chips = DIMENSION_ORDER.map((key) => byKey.get(key)).filter(
    (d): d is DimensionEval => Boolean(d),
  );

  return (
    <Card className="mb-8 border-foreground/10">
      <CardContent className="space-y-4">
        {/* Ligne titre + badge analyse personnalisée */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Synthèse
          </p>
          {usedAiProfile ? (
            <TooltipProvider delay={150}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/dashboard/settings/ai-profile"
                      aria-label="Voir le Profil IA dans les réglages"
                    />
                  }
                >
                  <Badge
                    variant="outline"
                    className="cursor-pointer gap-1 border-foreground/10 bg-mint text-foreground transition-colors hover:bg-mint/80"
                  >
                    <Sparkles className="size-3" aria-hidden />
                    Analyse personnalisée ✓
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Cette analyse a utilisé le Profil IA de votre organisation
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>

        {/* Résumé de l'appel (remonté ici depuis l'ancienne section Analyse) */}
        {summary ? (
          <p className="text-sm leading-relaxed text-foreground">{summary}</p>
        ) : null}

        {/* Chips de dimensions : libellé + pastille de statut */}
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {chips.map((dim) => {
              const meta = DIMENSION_META[dim.key];
              const statusMeta = STATUS_META[safeStatus(dim.status)];
              return (
                <span
                  key={dim.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
                >
                  <span
                    className={cn("size-1.5 rounded-full", statusMeta.dot)}
                    aria-hidden
                  />
                  {meta.short}
                </span>
              );
            })}
          </div>
        ) : null}

        {/* Pied : signaux à surveiller + prochaine action */}
        {signalsCount > 0 || nextAction ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 text-sm">
            {signalsCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-orange-700 dark:text-orange-300">
                <AlertTriangle className="size-4" aria-hidden />
                {signalsCount} signal{signalsCount > 1 ? "aux" : ""} à surveiller
              </span>
            ) : null}
            {nextAction ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <ArrowRight className="size-4 shrink-0" aria-hidden />
                <span className="text-foreground">{nextAction}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
