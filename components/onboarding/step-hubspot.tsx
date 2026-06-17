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

import { HubspotSettingsForm } from "@/components/dashboard/hubspot-settings-form";
import { TunnelPreview } from "@/components/dashboard/tunnel-preview";
import { OnboardingNav } from "@/components/onboarding/onboarding-nav";
import type { HubspotPipeline } from "@/lib/hubspot";

type Props = {
  hasHubspotToken: boolean;
  portalId: string;
  pipelines: HubspotPipeline[];
  syncedAt: string | null;
  /** Étape validée = token présent ET tunnel synchronisé. */
  done: boolean;
};

export function StepHubspot({
  hasHubspotToken,
  portalId,
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
        {/* Formulaire HubSpot réutilisé (auto-sync du tunnel à la connexion) */}
        <HubspotSettingsForm canEdit hasToken={hasHubspotToken} defaultPortalId={portalId} />

        {/* Le « waouh » : aperçu du tunnel remonté de HubSpot, une fois connecté. */}
        {hasHubspotToken ? (
          <div className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-medium">Votre tunnel, lu depuis HubSpot</h3>
            {pipelines.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Connexion enregistrée. Si le tunnel ne s&apos;affiche pas tout de
                suite, revérifiez les autorisations du token (lecture des deals et
                pipelines).
              </p>
            ) : (
              <TunnelPreview pipelines={pipelines} syncedAt={syncedAt} />
            )}
          </div>
        ) : null}

        {/* Aide pas-à-pas (pliable) */}
        <details className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            Comment créer mon token Private App&nbsp;?
          </summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-muted-foreground">
            <li>
              Dans HubSpot, ouvrez <strong>Paramètres</strong> (la roue dentée)
              &rsaquo; <strong>Intégrations</strong> &rsaquo;{" "}
              <strong>Applications privées</strong>.
            </li>
            <li>
              Cliquez sur <strong>Créer une application privée</strong>, nommez-la
              « Aloalo ».
            </li>
            <li>
              Onglet <strong>Scopes</strong> : cochez la lecture des{" "}
              <strong>contacts</strong>, <strong>entreprises</strong>,{" "}
              <strong>deals</strong> (crm.objects.*.read) et la lecture/écriture
              des <strong>tâches</strong> (pour pousser les suivis).
            </li>
            <li>
              Créez l&apos;application, puis copiez le{" "}
              <strong>token d&apos;accès</strong> (pat-…) dans le champ ci-dessus.
            </li>
            <li>
              Le <strong>Hub ID</strong> est le numéro en haut à droite de votre
              compte HubSpot.
            </li>
          </ol>
        </details>
      </div>

      <OnboardingNav nextStep="criteria" done={done} />
    </div>
  );
}
