"use client";

// ============================================================================
// Formulaire de connexion HubSpot (owner uniquement). J15.
// ============================================================================
// Deux champs : le Private App token (password, jamais rechargé côté client —
// l'input est toujours vide au rendu) et le Portal ID. Le bouton « Connecter
// HubSpot » sauvegarde puis teste la connexion ; on affiche un badge vert
// « Connecté ✓ » ou rouge « Token invalide » selon le résultat du test.
//
// Comme pour la clé Ringover : si l'owner laisse le token vide, le serveur ne
// l'écrase pas (et re-teste le token déjà en base).
// ============================================================================

import { useActionState } from "react";

import {
  updateHubspotSettings,
  type HubspotSettingsResult,
} from "@/app/dashboard/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  canEdit: boolean;
  hasToken: boolean;
  defaultPortalId: string;
};

export function HubspotSettingsForm({
  canEdit,
  hasToken,
  defaultPortalId,
}: Props) {
  const [state, formAction, pending] = useActionState<
    HubspotSettingsResult | null,
    FormData
  >(updateHubspotSettings, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hubspot-token">Token Private App</Label>
        <Input
          id="hubspot-token"
          name="hubspot_token"
          type="password"
          placeholder={
            hasToken
              ? "•••••••• (laisser vide pour conserver)"
              : "Collez votre token (pat-…)"
          }
          maxLength={200}
          disabled={!canEdit || pending}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Créez une « Private App » dans HubSpot &rsaquo; Paramètres &rsaquo;
          Intégrations &rsaquo; Private Apps, puis copiez le token d&apos;accès.
          Il est stocké côté serveur uniquement et n&apos;est jamais réaffiché.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hubspot-portal-id">Portal ID</Label>
        <Input
          id="hubspot-portal-id"
          name="hubspot_portal_id"
          type="text"
          inputMode="numeric"
          defaultValue={defaultPortalId}
          placeholder="Ex. 24681012"
          maxLength={20}
          disabled={!canEdit || pending}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Le « Hub ID » visible en haut à droite de votre compte HubSpot.
        </p>
      </div>

      {/* Résultat du test de connexion : badge vert / rouge / ambre. */}
      {state?.ok && state.connection === "connected" ? (
        <Badge
          variant="outline"
          className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          Connecté ✓
        </Badge>
      ) : null}
      {state?.ok && state.connection === "invalid" ? (
        <Badge
          variant="outline"
          className="border-destructive/50 bg-destructive/10 text-destructive"
        >
          Token invalide
        </Badge>
      ) : null}
      {state?.ok && state.connection === "unknown" ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {state.message}
        </p>
      ) : null}
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={!canEdit || pending}>
          {pending ? "Connexion…" : "Connecter HubSpot"}
        </Button>
      </div>

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">
          Seul le propriétaire peut connecter HubSpot.
        </p>
      ) : null}
    </form>
  );
}
