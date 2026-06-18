// ============================================================================
// components/onboarding/step-hubspot.tsx — Étape 2 : connexion HubSpot (J29)
// ============================================================================
// Réutilise le formulaire HubSpot existant (qui auto-synchronise le tunnel à la
// connexion, cf. updateHubspotSettings / J27). Une fois connecté, on affiche
// l'aperçu du tunnel (TunnelPreview) — c'est le moment « waouh » : l'utilisateur
// colle un token et voit aussitôt sa carte de pipelines remontée de HubSpot.
// Encart pliable « comment créer mon token Private App » pour tenir les 10 min.
// ============================================================================

import { Plug } from "lucide-react";

import { HubspotConnection } from "@/components/dashboard/hubspot-connection";
import { TunnelPreview } from "@/components/dashboard/tunnel-preview";
import { OnboardingNav } from "@/components/onboarding/onboarding-nav";
import type { HubspotPipeline } from "@/lib/hubspot";

type Props = {
  hasHubspotToken: boolean;
  pipelines: HubspotPipeline[];
  syncedAt: string | null;
  /** Étape validée = connecté ET tunnel synchronisé. */
  done: boolean;
};

export function StepHubspot({
  hasHubspotToken,
  pipelines,
  syncedAt,
  done,
}: Props) {
  return (
    <div>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-mint">
          <Plug className="size-5 text-foreground" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Connectez votre CRM HubSpot
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Dès que HubSpot est connecté, Aloalo lit la carte de votre tunnel
          (pipelines et phases) — la base pour relier chaque appel au bon deal et
          proposer vos critères de sortie à l&apos;étape suivante.
        </p>
      </div>

      <div className="space-y-6 rounded-lg border border-border bg-background p-5">
        {/* Connexion en un clic via OAuth (J38) — retour sur l'onboarding. */}
        <HubspotConnection
          connected={hasHubspotToken}
          canEdit
          startUrl="/api/hubspot/oauth/start?return=onboarding"
        />

        {/* Le « waouh » : aperçu du tunnel remonté de HubSpot, une fois connecté. */}
        {hasHubspotToken ? (
          <div className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-medium">Votre tunnel, lu depuis HubSpot</h3>
            {pipelines.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Connexion enregistrée. Si le tunnel ne s&apos;affiche pas tout de
                suite, vérifiez que l&apos;app dispose bien des autorisations de
                lecture des deals et pipelines.
              </p>
            ) : (
              <TunnelPreview pipelines={pipelines} syncedAt={syncedAt} />
            )}
          </div>
        ) : null}
      </div>

      <OnboardingNav nextStep="criteria" done={done} />
    </div>
  );
}
