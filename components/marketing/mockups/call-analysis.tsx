// ============================================================================
// Réplique — écran « appel analysé » (/dashboard/calls/[id])
// ============================================================================
// Reprend les vrais blocs : barre de synthèse, chips de dimensions, point fort
// justifié par une citation, tuiles de dynamique conversationnelle.
//
// Les métadonnées de dimensions et de statuts sont IMPORTÉES du composant réel
// (`components/dashboard/dimensions-eval.tsx`) : si les libellés ou les
// couleurs changent dans le produit, la vitrine suit automatiquement.
// ============================================================================

import { Mic, Repeat, Timer } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  DIMENSION_META,
  DIMENSION_ORDER,
  STATUS_META,
} from "@/components/dashboard/dimensions-eval";
import type { DimensionStatus } from "@/lib/claude";
import { cn } from "@/lib/utils";

import { Frame } from "./frame";

// Données fictives, cohérentes avec les scénarios du simulateur.
const STATUSES: Record<string, DimensionStatus> = {
  discovery: "validé",
  qualification: "validé",
  objection_handling: "partiel",
  closing: "partiel",
  next_step: "manqué",
};

const METRICS = [
  { icon: Mic, label: "Temps de parole", value: "38 %", hint: "commercial" },
  { icon: Repeat, label: "Ping-pong", value: "24", hint: "tours de parole" },
  { icon: Timer, label: "Monologue max", value: "1:47", hint: "d'affilée" },
];

export function CallAnalysisMockup({ className }: { className?: string }) {
  return (
    <Frame
      label="aloalo.app / appels / Camille Roux — Acme Corp"
      activeItem="Mes appels"
      className={className}
    >
      <div className="space-y-3">
        {/* En-tête de l'appel */}
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-medium">
              Camille Roux — Acme Corp
            </p>
            <p className="font-mono text-[11px] tracking-[-0.03em] text-muted-foreground">
              Découverte · 18 min · aujourd&apos;hui, 10:24
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-medium text-mint-foreground">
            Analysé
          </span>
        </div>

        {/* Barre de synthèse */}
        <Card size="sm">
          <CardContent className="space-y-3">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Synthèse
            </p>
            <p className="text-[13px] leading-relaxed text-foreground">
              Acme veut réduire le temps de saisie CRM de ses 12 commerciaux.
              Budget confirmé, décision partagée avec la DAF. L&apos;objection
              prix a été traitée, mais l&apos;appel s&apos;est terminé sans date
              de prochaine étape.
            </p>

            {/* Chips de dimensions */}
            <div className="flex flex-wrap gap-1.5">
              {DIMENSION_ORDER.map((key) => {
                const status = STATUSES[key];
                const meta = STATUS_META[status];
                return (
                  <span
                    key={key}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      meta.pill,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", meta.dot)} />
                    {DIMENSION_META[key].short}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Une évaluation sourcée par une citation — le cœur de la promesse */}
        <Card size="sm">
          <CardContent className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium">Next step</p>
                <p className="text-[11px] text-muted-foreground">
                  {DIMENSION_META.next_step.hint}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  STATUS_META["manqué"].pill,
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    STATUS_META["manqué"].dot,
                  )}
                />
                Manqué
              </span>
            </div>
            <p className="border-l-2 border-foreground/15 pl-3 text-[12px] leading-relaxed text-muted-foreground italic">
              « Je vous rappelle dans les prochains jours pour caler quelque
              chose. »
            </p>
          </CardContent>
        </Card>

        {/* Métriques déterministes (calculées sans IA) */}
        <div className="grid grid-cols-3 gap-2">
          {METRICS.map(({ icon: Icon, label, value, hint }) => (
            <Card key={label} size="sm">
              <CardContent className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon className="size-3" />
                  <span className="truncate">{label}</span>
                </div>
                <p className="font-heading text-xl font-bold tabular-nums">
                  {value}
                </p>
                <p className="text-[10px] text-muted-foreground">{hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Frame>
  );
}
