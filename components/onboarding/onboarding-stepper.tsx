// ============================================================================
// components/onboarding/onboarding-stepper.tsx — Fil d'Ariane de l'assistant
// ============================================================================
// Présentationnel pur (server-safe). Affiche les 3 étapes du parcours avec leur
// état : faite (menthe + ✓), active (anneau foreground), à venir (grise). L'ordre
// vient de ONBOARDING_STEPS (téléphonie → HubSpot → critères).
// ============================================================================

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from "@/lib/onboarding";

const STEP_LABELS: Record<OnboardingStepId, string> = {
  telephony: "Téléphonie",
  hubspot: "HubSpot",
  criteria: "Critères",
};

type Props = {
  steps: Record<OnboardingStepId, boolean>;
  activeStep: OnboardingStepId;
};

export function OnboardingStepper({ steps, activeStep }: Props) {
  const activeIndex = ONBOARDING_STEPS.indexOf(activeStep);

  return (
    <ol className="mb-8 flex items-center justify-center gap-2">
      {ONBOARDING_STEPS.map((id, i) => {
        const done = steps[id];
        const active = id === activeStep;
        return (
          <li key={id} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                  done
                    ? "border-transparent bg-mint text-foreground"
                    : active
                      ? "border-foreground bg-background text-foreground"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {STEP_LABELS[id]}
              </span>
            </div>
            {i < ONBOARDING_STEPS.length - 1 ? (
              <span
                className={cn(
                  "mb-5 h-px w-8",
                  i < activeIndex ? "bg-foreground/40" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
