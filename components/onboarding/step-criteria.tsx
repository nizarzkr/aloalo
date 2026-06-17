// ============================================================================
// components/onboarding/step-criteria.tsx — Étape 3 : critères de sortie (J29)
// ============================================================================
// Réutilise l'éditeur de critères existant (ExitCriteriaEditor / J28). L'IA
// propose les critères par phase ouverte, l'owner valide/ajuste. Si le tunnel
// n'est pas encore synchronisé (HubSpot non connecté), on renvoie à l'étape
// précédente — les critères dépendent de la carte du tunnel.
// ============================================================================

import Link from "next/link";
import { ListChecks } from "lucide-react";

import {
  ExitCriteriaEditor,
  type EditorPipeline,
} from "@/components/dashboard/exit-criteria-editor";
import { OnboardingNav } from "@/components/onboarding/onboarding-nav";

type Props = {
  editorPipelines: EditorPipeline[];
  hasAnyCriteria: boolean;
  /** Étape validée = au moins une phase a des critères enregistrés. */
  done: boolean;
};

export function StepCriteria({ editorPipelines, hasAnyCriteria, done }: Props) {
  const hasTunnel = editorPipelines.length > 0;

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-mint">
          <ListChecks className="size-5 text-foreground" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Validez vos critères de sortie
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Pour chaque phase de votre tunnel, l&apos;IA propose ce qui doit être
          vrai pour qu&apos;un deal avance. Vous ajustez en quelques clics — c&apos;est
          ce qu&apos;Aloalo vérifiera ensuite sur vos appels.
        </p>
      </div>

      {hasTunnel ? (
        <ExitCriteriaEditor
          pipelines={editorPipelines}
          hasAnyCriteria={hasAnyCriteria}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun tunnel HubSpot synchronisé pour le moment. Connectez HubSpot à
            l&apos;étape précédente, puis revenez ici proposer vos critères.
          </p>
          <Link
            href="/onboarding?step=hubspot"
            className="mt-3 inline-block text-sm font-medium text-foreground underline underline-offset-4"
          >
            ← Revenir à l&apos;étape HubSpot
          </Link>
        </div>
      )}

      <OnboardingNav nextStep={null} done={done} />
    </div>
  );
}
