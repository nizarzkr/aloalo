"use client";

// ============================================================================
// Connexion Pipedrive via OAuth (J46).
// ============================================================================
// Miroir de HubspotConnection : l'owner clique « Connecter Pipedrive » →
// /api/pipedrive/oauth/start (state anti-CSRF + redirection vers l'autorisation
// Pipedrive). Au retour, le callback stocke les jetons chiffrés + l'api_domain,
// pose crm_provider='pipedrive', et renvoie ici avec ?pipedrive=connected.
//
// Quand c'est déjà connecté : « Déconnecter » (Server Action disconnectPipedrive)
// + « Reconnecter » (relance le flux).
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plug, Unplug } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { disconnectPipedrive } from "@/app/dashboard/settings/actions";

export function PipedriveConnection({
  connected,
  canEdit,
  startUrl = "/api/pipedrive/oauth/start",
}: {
  connected: boolean;
  canEdit: boolean;
  startUrl?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleDisconnect() {
    setMessage(null);
    startTransition(async () => {
      const result = await disconnectPipedrive();
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) router.refresh();
    });
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Connectez votre compte Pipedrive en un clic. Vous serez redirigé vers
          Pipedrive pour autoriser l&apos;accès ; aucun jeton à copier-coller. Les
          jetons sont stockés chiffrés côté serveur.
        </p>
        {canEdit ? (
          <a href={startUrl} className={buttonVariants()}>
            <Plug className="size-4" />
            Connecter Pipedrive
          </a>
        ) : (
          <Button disabled>
            <Plug className="size-4" />
            Connecter Pipedrive
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Votre compte Pipedrive est connecté. Aloalo renouvelle l&apos;accès
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
