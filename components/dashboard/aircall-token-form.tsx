"use client";

// ============================================================================
// Formulaire du token de webhook Aircall (owner uniquement) — J44.
// ============================================================================
// L'owner colle le « token » de son webhook Aircall. Le serveur en stocke le
// SHA-256 (jamais le token en clair) → l'input est toujours vide au rendu et un
// envoi vide est un no-op (on ne réinitialise pas par accident).
// ============================================================================

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateAircallWebhookToken,
  type UpdateOrgResult,
} from "@/app/dashboard/settings/actions";

type Props = {
  canEdit: boolean;
  hasToken: boolean;
};

export function AircallTokenForm({ canEdit, hasToken }: Props) {
  const [state, formAction, pending] = useActionState<
    UpdateOrgResult | null,
    FormData
  >(updateAircallWebhookToken, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="aircall-token">Token du webhook Aircall</Label>
        <Input
          id="aircall-token"
          name="aircall_webhook_token"
          type="password"
          placeholder={
            hasToken
              ? "•••••••• (laisser vide pour conserver)"
              : "Collez le token de votre webhook"
          }
          maxLength={300}
          disabled={!canEdit || pending}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Aircall affiche ce token à la création du webhook (Dashboard &rsaquo;
          Integrations &rsaquo; Webhooks). Il sert à rattacher vos appels à votre
          organisation. Stocké côté serveur sous forme de hash uniquement.
        </p>
      </div>

      {state?.ok ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {state.message}
        </p>
      ) : state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={!canEdit || pending}>
        {pending ? "Enregistrement…" : "Enregistrer le token"}
      </Button>
    </form>
  );
}
