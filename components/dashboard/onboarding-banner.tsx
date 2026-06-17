// ============================================================================
// components/dashboard/onboarding-banner.tsx — Bandeau de reprise d'onboarding
// ============================================================================
// Affiché sur l'accueil du dashboard quand l'owner a cliqué « passer pour
// l'instant » (sinon il serait redirigé vers /onboarding). Rappelle où il en est
// (X/3 étapes) et propose de reprendre. Présentationnel pur (server-safe).
// ============================================================================

import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  doneCount: number;
  totalSteps: number;
};

export function OnboardingBanner({ doneCount, totalSteps }: Props) {
  return (
    <div className="mb-8 flex flex-col items-start gap-3 rounded-lg border border-border bg-mint/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint">
          <Rocket className="size-4 text-foreground" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            Terminez la configuration d&apos;Aloalo
          </p>
          <p className="text-xs text-muted-foreground">
            {doneCount}/{totalSteps} étapes faites — il vous reste quelques
            minutes pour commencer à analyser vos appels.
          </p>
        </div>
      </div>
      <Link
        href="/onboarding"
        className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
      >
        Reprendre la configuration
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
