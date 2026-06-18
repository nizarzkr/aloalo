"use client";

// ============================================================================
// Connexion HubSpot via OAuth (J38).
// ============================================================================
// Remplace l'ancien formulaire « coller le Private App token ». L'owner clique
// « Connecter HubSpot » → /api/hubspot/oauth/start (qui pose un state anti-CSRF
// et redirige vers la page d'autorisation HubSpot). Au retour, le callback
// stocke les jetons chiffrés et renvoie ici avec ?hubspot=connected.
//
// Quand c'est déjà connecté : bouton « Déconnecter » (Server Action
// disconnectHubspot) + lien « Reconnecter » (relance le flux, utile pour
// élargir les scopes ou réparer une connexion expirée).
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plug, Unplug } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { disconnectHubspot } from "@/app/dashboard/settings/actions";

export function HubspotConnection({
  connected,
  canEdit,
  startUrl = "/api/hubspot/oauth/start",
}: {
  connected: boolean;
  canEdit: boolean;
  /** URL du démarrage OAuth (peut porter ?return=onboarding pour revenir au wizard). */
  startUrl?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleDisconnect() {
    setMessage(null);
    startTransition(async () => {
      const result = await disconnectHubspot();
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) router.refresh();
    });
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Connectez votre portail HubSpot en un clic. Vous serez redirigé vers
          HubSpot pour autoriser l&apos;accès ; aucun jeton à copier-coller. Les
          jetons sont stockés chiffrés côté serveur.
        </p>
        {canEdit ? (
          <a href={startUrl} className={buttonVariants()}>
            <Plug className="size-4" />
            Connecter HubSpot
          </a>
        ) : (
          <Button disabled>
            <Plug className="size-4" />
            Connecter HubSpot
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Votre portail HubSpot est connecté. Aloalo renouvelle l&apos;accès
        automatiquement.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <a
            href={startUrl}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Plug className="size-4" />
            Reconnecter
          </a>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={isPending || !canEdit}
          aria-live="polite"
        >
          <Unplug className={isPending ? "size-4 animate-pulse" : "size-4"} />
          {isPending ? "Déconnexion…" : "Déconnecter"}
        </Button>
        {message ? (
          <span className="text-xs text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
