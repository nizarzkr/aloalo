"use client";

// ============================================================================
// Formulaire d'enregistrement de la clé API Ringover (owner uniquement).
// ============================================================================
// La clé n'est JAMAIS rechargée côté client — l'input est toujours vide au
// rendu. Si le user veut la modifier, il retape la nouvelle valeur. S'il
// laisse vide et soumet, le serveur ne fait rien (no-op silencieux), pour
// éviter d'effacer la clé par accident.
//
// L'attribut type="password" masque les caractères et empêche le navigateur
// d'auto-remplir avec un mot de passe quelconque (autoComplete="off").
// ============================================================================

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateRingoverApiKey,
  type UpdateOrgResult,
} from "@/app/dashboard/settings/actions";

type Props = {
  canEdit: boolean;
  hasKey: boolean;
};

export function RingoverKeyForm({ canEdit, hasKey }: Props) {
  const [state, formAction, pending] = useActionState<
    UpdateOrgResult | null,
    FormData
  >(updateRingoverApiKey, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="ringover-key">Clé API Ringover</Label>
        <Input
          id="ringover-key"
          name="ringover_api_key"
          type="password"
          placeholder={hasKey ? "•••••••• (laisser vide pour conserver)" : "Collez votre clé API"}
          maxLength={200}
          disabled={!canEdit || pending}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Trouvez votre clé dans Ringover &rsaquo; Paramètres &rsaquo;
          Intégrations &rsaquo; API. Elle reste stockée côté serveur uniquement.
        </p>
      </div>

      {state?.ok ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {state.message}
        </p>
      ) : null}
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={!canEdit || pending}>
          {pending ? "Enregistrement…" : "Enregistrer la clé"}
        </Button>
      </div>

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">
          Seul le propriétaire peut modifier la clé API.
        </p>
      ) : null}
    </form>
  );
}
