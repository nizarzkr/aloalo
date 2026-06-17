// ============================================================================
// DealHygienePanel (J31) — bloc « Hygiène du deal » sur la page trajectoire.
// ============================================================================
// Affiche les écarts dit/CRM détectés par le moteur J30 (cache deal_hygiene),
// priorisés, et propose la correction 1 clic par écart (tâche HubSpot, non
// destructif). Server Component : il LIT le rapport déjà passé en props et
// délègue le geste agentic au bouton client PushHygieneFixButton.
//
// États : aucun écart (RAS) · pas encore calculé (CTA Analyser) · liste d'écarts.
// ============================================================================

import { CheckCircle2, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushHygieneFixButton } from "@/components/dashboard/push-hygiene-fix-button";
import { AnalyzePipelineButton } from "@/components/dashboard/analyze-pipeline-button";
import { hygieneActionType } from "@/lib/hygiene/rules";
import { hygienePushedKey } from "@/lib/deals/pushed-actions";
import type { HygieneGap, HygieneReport, HygieneSeverity } from "@/lib/hygiene/types";
import { cn } from "@/lib/utils";

const SEVERITY_DOT: Record<HygieneSeverity, string> = {
  high: "bg-red-400",
  medium: "bg-yellow",
  low: "bg-muted-foreground/40",
};

export function DealHygienePanel({
  groupKey,
  report,
  pushedKeys,
}: {
  groupKey: string;
  report: HygieneReport | null;
  pushedKeys: Set<string>;
}) {
  const gaps = report?.gaps ?? [];

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-5 text-muted-foreground" aria-hidden />
          Hygiène du deal
        </CardTitle>
      </CardHeader>
      <CardContent>
        {report === null ? (
          // Pas encore de rapport (deal analysé avant J30) → calcul à la demande.
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              L&apos;hygiène de ce deal n&apos;a pas encore été calculée. Lancez
              l&apos;analyse du pipeline pour détecter d&apos;éventuels écarts
              entre le CRM et la réalité des appels.
            </p>
            <AnalyzePipelineButton />
          </div>
        ) : gaps.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
            Aucun écart détecté — le CRM est cohérent avec la réalité des appels.
          </p>
        ) : (
          <ul className="space-y-4">
            {gaps.map((gap, i) => (
              <HygieneGapRow
                key={`${gap.type}-${i}`}
                groupKey={groupKey}
                gap={gap}
                alreadyPushed={pushedKeys.has(
                  hygienePushedKey(groupKey, hygieneActionType(gap.type)),
                )}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function HygieneGapRow({
  groupKey,
  gap,
  alreadyPushed,
}: {
  groupKey: string;
  gap: HygieneGap;
  alreadyPushed: boolean;
}) {
  return (
    <li className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            SEVERITY_DOT[gap.severity],
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{gap.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{gap.detail}</p>

          {gap.unmet_criteria && gap.unmet_criteria.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {gap.unmet_criteria.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span className="size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  {c.label}
                </li>
              ))}
            </ul>
          ) : null}

          {gap.suggested_stage_hint ? (
            <p className="mt-1.5 text-xs italic text-muted-foreground">
              {gap.suggested_stage_hint}
            </p>
          ) : null}

          {/* Correction 1 clic : seulement si une action est proposée. */}
          {gap.suggested_action ? (
            <div className="mt-3">
              <PushHygieneFixButton
                groupKey={groupKey}
                gapType={gap.type}
                alreadyPushed={alreadyPushed}
              />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
