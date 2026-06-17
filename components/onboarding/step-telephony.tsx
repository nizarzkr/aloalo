// ============================================================================
// components/onboarding/step-telephony.tsx — Étape 1 : connexion Ringover (J29)
// ============================================================================
// Réutilise le formulaire de clé Ringover existant + affiche l'URL du webhook à
// coller côté Ringover. Un encart pliable détaille « où cliquer » pour tenir
// l'objectif des 10 min (le temps de config est chez le fournisseur, pas dans
// Aloalo → on guide pas à pas).
// ============================================================================

import { Phone } from "lucide-react";

import { CopyButton } from "@/components/dashboard/copy-button";
import { RingoverKeyForm } from "@/components/dashboard/ringover-key-form";
import { OnboardingNav } from "@/components/onboarding/onboarding-nav";

type Props = {
  hasRingoverKey: boolean;
  webhookUrl: string;
};

export function StepTelephony({ hasRingoverKey, webhookUrl }: Props) {
  return (
    <div>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-mint">
          <Phone className="size-5 text-foreground" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Connectez votre téléphonie
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Aloalo récupère l&apos;enregistrement de chaque appel via Ringover pour
          le transcrire et l&apos;analyser. Deux choses à faire : coller votre clé
          API, puis l&apos;URL du webhook dans Ringover.
        </p>
      </div>

      <div className="space-y-6 rounded-lg border border-border bg-background p-5">
        {/* 1. Clé API Ringover (formulaire réutilisé) */}
        <RingoverKeyForm canEdit hasKey={hasRingoverKey} />

        {/* 2. URL du webhook à coller dans Ringover */}
        <div className="space-y-2 border-t border-border pt-5">
          <h3 className="text-sm font-medium">URL du webhook</h3>
          <p className="text-xs text-muted-foreground">
            Collez cette URL dans Ringover &rsaquo; Paramètres &rsaquo; Webhooks
            pour déclencher la synchronisation à chaque appel terminé.
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
              {webhookUrl || "URL non configurée (NEXT_PUBLIC_APP_URL manquant)"}
            </code>
            {webhookUrl ? (
              <CopyButton value={webhookUrl} label="Copier l'URL" />
            ) : null}
          </div>
        </div>

        {/* Aide pas-à-pas (pliable, sans dépendance) */}
        <details className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            Où trouver ma clé API Ringover&nbsp;?
          </summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-muted-foreground">
            <li>
              Connectez-vous à votre espace Ringover (dashboard.ringover.com).
            </li>
            <li>
              Ouvrez <strong>Paramètres</strong> &rsaquo;{" "}
              <strong>Intégrations</strong> &rsaquo; <strong>API</strong>.
            </li>
            <li>
              Générez (ou copiez) une clé API et collez-la dans le champ ci-dessus.
            </li>
            <li>
              Dans <strong>Webhooks</strong>, ajoutez l&apos;URL ci-dessus sur
              l&apos;événement « appel terminé ».
            </li>
          </ol>
        </details>
      </div>

      <OnboardingNav nextStep="hubspot" done={hasRingoverKey} />
    </div>
  );
}
