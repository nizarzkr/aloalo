// ============================================================================
// components/onboarding/onboarding-nav.tsx — Pied de navigation d'une étape
// ============================================================================
// Server component : rend le bas de chaque étape de l'assistant.
//   - étape intermédiaire : « Continuer → » (lien vers l'étape suivante) +, si
//     l'étape n'est pas encore validée, un lien discret « Passer cette étape »
//     (non bloquant — l'onboarding ne force jamais une étape).
//   - dernière étape : bouton « Terminer la configuration » (server action
//     completeOnboarding → horodate + redirige vers le dashboard).
//
// La sortie globale « passer pour l'instant » (snooze) vit dans le header du
// layout, disponible à toutes les étapes.
// ============================================================================

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { completeOnboarding } from "@/app/onboarding/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingStepId } from "@/lib/onboarding";

type Props = {
  /** Étape suivante, ou null si c'est la dernière. */
  nextStep: OnboardingStepId | null;
  /** L'étape courante a-t-elle son signal réel présent ? */
  done: boolean;
};

export function OnboardingNav({ nextStep, done }: Props) {
  if (nextStep === null) {
    // Dernière étape : on termine l'assistant.
    return (
      <div className="mt-8 flex flex-col items-center gap-3 border-t border-border pt-6">
        <form action={completeOnboarding} className="w-full sm:w-auto">
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            Terminer la configuration
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
      {/* Lien discret « Passer cette étape » tant qu'elle n'est pas validée. */}
      {done ? (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          Étape validée ✓
        </span>
      ) : (
        <Link
          href={`/onboarding?step=${nextStep}`}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Passer cette étape
        </Link>
      )}

      <Link
        href={`/onboarding?step=${nextStep}`}
        className={cn(buttonVariants({ size: "lg" }))}
      >
        Continuer
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
