"use client";

// ============================================================================
// Connexion Google Meet via OAuth (J42).
// ============================================================================
// L'owner clique « Connecter Google Meet » → /api/google/oauth/start (state
// anti-CSRF + redirection vers l'autorisation Google). Au retour, le callback
// stocke les jetons chiffrés et renvoie ici avec ?google=connected.
//
// Quand c'est déjà connecté : bouton « Déconnecter » (Server Action
// disconnectGoogle) + lien « Reconnecter ». Calqué sur HubspotConnection.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plug, Unplug } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { disconnectGoogle } from "@/app/dashboard/settings/actions";

export function GoogleConnection({
  connected,
  canEdit,
  email,
  startUrl = "/api/google/oauth/start",
}: {
  connected: boolean;
  canEdit: boolean;
  /** Email du compte Google connecté (affichage), si connu. */
  email?: string | null;
  /** URL du démarrage OAuth (peut porter ?return=onboarding). */
  startUrl?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleDisconnect() {
    setMessage(null);
    startTransition(async () => {
      const result = await disconnectGoogle();
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) router.refresh();
    });
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Connectez votre compte Google Workspace en un clic. Aloalo lira la
          transcription native de vos réunions Meet (aucun fichier à
          télécharger). Les jetons sont stockés chiffrés côté serveur.
        </p>
        {canEdit ? (
          <a href={startUrl} className={buttonVariants()}>
            <Plug className="size-4" />
            Connecter Google Meet
          </a>
        ) : (
          <Button disabled>
            <Plug className="size-4" />
            Connecter Google Meet
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Compte Google connecté{email ? ` (${email})` : ""}. Aloalo renouvelle
        l&apos;accès automatiquement.
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
