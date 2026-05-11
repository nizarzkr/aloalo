// ============================================================================
// Bannière affichée sur /dashboard/calls/[id] quand l'analyse a échoué pour
// cause de quota mensuel atteint (error_message taggé "USAGE_LIMIT_REACHED").
// ============================================================================
// Server Component pur — aucune interactivité, juste un lien vers /billing.
// ============================================================================

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function UpgradeBanner({
  errorMessage,
}: {
  errorMessage: string | null | undefined;
}) {
  // On affiche UNIQUEMENT si le tag USAGE_LIMIT_REACHED est présent.
  // Tout autre type d'échec (Claude API, DB, etc.) n'affiche pas la bannière.
  if (!errorMessage?.includes("USAGE_LIMIT_REACHED")) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="font-medium text-amber-900">
        Limite atteinte — passez au plan Starter pour continuer
      </p>
      <p className="mt-1 text-sm text-amber-800">
        Votre quota d&apos;analyses pour la période en cours est consommé.
        Choisissez un plan supérieur pour relancer cette analyse et toutes les
        suivantes.
      </p>
      <Link
        href="/dashboard/billing"
        className={buttonVariants({ variant: "default" }) + " mt-3"}
      >
        Voir les plans
      </Link>
    </div>
  );
}
