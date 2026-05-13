"use client";

// ============================================================================
// Formulaire d'édition de l'organisation (nom + URL logo).
// ============================================================================
// Client Component minimal : utilise useActionState pour afficher inline
// success/error sans rechargement. Le Server Action lui-même vit dans
// app/dashboard/settings/actions.ts.
//
// On garde le composant désactivé si l'utilisateur n'est pas owner — le
// serveur re-bloquera l'écriture, mais on évite l'expérience frustrante du
// formulaire qui semble fonctionnel mais échoue à l'envoi.
// ============================================================================

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateOrganization,
  type UpdateOrgResult,
} from "@/app/dashboard/settings/actions";

type Props = {
  defaultName: string;
  defaultLogoUrl: string;
  canEdit: boolean;
};

export function OrgSettingsForm({ defaultName, defaultLogoUrl, canEdit }: Props) {
  const [state, formAction, pending] = useActionState<
    UpdateOrgResult | null,
    FormData
  >(updateOrganization, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">Nom de l&apos;organisation</Label>
        <Input
          id="org-name"
          name="name"
          type="text"
          defaultValue={defaultName}
          required
          maxLength={120}
          disabled={!canEdit || pending}
          autoComplete="organization"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-logo">URL du logo (optionnel)</Label>
        <Input
          id="org-logo"
          name="logo_url"
          type="url"
          defaultValue={defaultLogoUrl}
          placeholder="https://votresite.com/logo.png"
          maxLength={500}
          disabled={!canEdit || pending}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Collez l&apos;URL publique d&apos;une image (PNG, JPG ou SVG).
          L&apos;upload de fichier n&apos;est pas encore disponible.
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

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" disabled={!canEdit || pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">
          Seul le propriétaire de l&apos;organisation peut modifier ces
          informations.
        </p>
      ) : null}
    </form>
  );
}
