// ============================================================================
// Bannière affichée sur /dashboard/calls/[id] quand l'analyse a échoué pour
// cause de quota mensuel atteint (error_message taggé "USAGE_LIMIT_REACHED").
// ============================================================================
// Server Component pur — aucune interactivité, juste un lien vers /billing.
// Le tag DB suit le format : "USAGE_LIMIT_REACHED: <used>/<limit> (<plan>)"
// (cf. app/api/analyze/route.ts). On parse used/limit pour afficher (X/Y).
// ============================================================================

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

// Extrait used et limit depuis le tag DB. Tolère les variations de format :
// si le parsing échoue, on affiche la bannière sans les chiffres.
function parseUsage(errorMessage: string): { used: number; limit: number } | null {
  const match = errorMessage.match(/USAGE_LIMIT_REACHED:\s*(\d+)\/(\d+)/);
  if (!match) return null;
  return { used: Number(match[1]), limit: Number(match[2]) };
}

export function UpgradeBanner({
  errorMessage,
}: {
  errorMessage: string | null | undefined;
}) {
  // On affiche UNIQUEMENT si le tag USAGE_LIMIT_REACHED est présent.
  // Tout autre type d'échec (Claude API, DB, etc.) n'affiche pas la bannière.
  if (!errorMessage?.includes("USAGE_LIMIT_REACHED")) return null;

  const usage = parseUsage(errorMessage);

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="font-medium text-amber-900">
        {usage
          ? `Limite mensuelle atteinte (${usage.used}/${usage.limit} analyses)`
          : "Limite mensuelle atteinte"}
      </p>
      <p className="mt-1 text-sm text-amber-800">
        Votre quota d&apos;analyses pour la période en cours est consommé.
        Passez à un plan supérieur pour relancer cette analyse et toutes les
        suivantes.
      </p>
      <Link
        href="/dashboard/settings/billing"
        className={buttonVariants({ variant: "default" }) + " mt-3"}
      >
        Upgrader
      </Link>
    </div>
  );
}
