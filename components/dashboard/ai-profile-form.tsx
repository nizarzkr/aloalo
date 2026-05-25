"use client";

// ============================================================================
// Formulaire d'édition du profil IA de l'organisation.
// ============================================================================
// Client Component minimal : 6 textareas + 1 input methodology, useActionState
// pour afficher inline le résultat du Server Action (success/error) sans
// reload. Pattern identique à OrgSettingsForm.
//
// Tous les champs sont optionnels — l'owner peut remplir progressivement.
// Le rendu reste désactivé si l'utilisateur n'est pas owner (le serveur
// re-bloque, mais on évite l'expérience d'un formulaire trompeur).
//
// Compteur de caractères : chaque champ est controlled (value + onChange) pour
// pouvoir afficher "X / 1000" sous le label et passer rouge à la limite. Le
// `maxLength` HTML reste posé en garde-fou (le serveur revalide aussi via Zod).
// ============================================================================

import { useActionState, useState } from "react";

import {
  updateAiProfile,
  type UpdateOrgResult,
} from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AiProfileData } from "@/lib/validations";

const MAX_LEN = 1000;

type Props = {
  defaultValues: Partial<AiProfileData> | null;
  canEdit: boolean;
};

type FieldKey =
  | "activity"
  | "icp"
  | "objections"
  | "offer"
  | "value_prop"
  | "competitors"
  | "methodology";

// Helper : transforme une valeur potentiellement null/undefined en string vide
// (React refuse `value={null}` sur un input controlled).
function s(value: string | null | undefined): string {
  return value ?? "";
}

export function AiProfileForm({ defaultValues, canEdit }: Props) {
  const [state, formAction, pending] = useActionState<
    UpdateOrgResult | null,
    FormData
  >(updateAiProfile, null);

  const v = defaultValues ?? {};

  // Un seul state object pour les 7 champs. Plus simple à maintenir que 7
  // useState séparés et permet de calculer un compteur dérivé sans drama.
  const [values, setValues] = useState<Record<FieldKey, string>>({
    activity: s(v.activity),
    icp: s(v.icp),
    objections: s(v.objections),
    offer: s(v.offer),
    value_prop: s(v.value_prop),
    competitors: s(v.competitors),
    methodology: s(v.methodology),
  });

  const update =
    (key: FieldKey) =>
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
    };

  // Petit composant interne pour ne pas dupliquer la ligne label+compteur
  // sous chaque champ.
  function FieldHeader({ htmlFor, label, value }: {
    htmlFor: string;
    label: string;
    value: string;
  }) {
    const len = value.length;
    // Le maxLength HTML empêche normalement de dépasser, mais on garde un
    // état visuel "limite atteinte" dès qu'on touche 1000.
    const atLimit = len >= MAX_LEN;
    return (
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        <span
          className={cn(
            "text-xs tabular-nums",
            atLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {len} / {MAX_LEN}
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <FieldHeader
          htmlFor="ai-activity"
          label="Décrivez votre activité"
          value={values.activity}
        />
        <Textarea
          id="ai-activity"
          name="activity"
          value={values.activity}
          onChange={update("activity")}
          placeholder="Ex. SaaS RH B2B pour PME françaises (10–200 employés)."
          maxLength={MAX_LEN}
          rows={3}
          disabled={!canEdit || pending}
        />
      </div>

      <div className="space-y-2">
        <FieldHeader
          htmlFor="ai-icp"
          label="Profil client idéal (ICP)"
          value={values.icp}
        />
        <Textarea
          id="ai-icp"
          name="icp"
          value={values.icp}
          onChange={update("icp")}
          placeholder="Ex. DRH ou Head of People dans une PME de 50–200 personnes, secteur tertiaire, basée en France."
          maxLength={MAX_LEN}
          rows={3}
          disabled={!canEdit || pending}
        />
      </div>

      <div className="space-y-2">
        <FieldHeader
          htmlFor="ai-objections"
          label="Principales objections + réponses type"
          value={values.objections}
        />
        <Textarea
          id="ai-objections"
          name="objections"
          value={values.objections}
          onChange={update("objections")}
          placeholder={
            "Ex.\n– « C'est trop cher » → ROI démontré en 3 mois, étude de cas X.\n– « On a déjà un outil » → on s'intègre, on ne remplace pas."
          }
          maxLength={MAX_LEN}
          rows={4}
          disabled={!canEdit || pending}
        />
      </div>

      <div className="space-y-2">
        <FieldHeader
          htmlFor="ai-offer"
          label="Offre principale + pricing indicatif"
          value={values.offer}
        />
        <Textarea
          id="ai-offer"
          name="offer"
          value={values.offer}
          onChange={update("offer")}
          placeholder="Ex. Forfait Pro à 49 €/user/mois, engagement 12 mois, onboarding inclus."
          maxLength={MAX_LEN}
          rows={3}
          disabled={!canEdit || pending}
        />
      </div>

      <div className="space-y-2">
        <FieldHeader
          htmlFor="ai-value-prop"
          label="Proposition de valeur unique"
          value={values.value_prop}
        />
        <Textarea
          id="ai-value-prop"
          name="value_prop"
          value={values.value_prop}
          onChange={update("value_prop")}
          placeholder="Ex. Le seul outil de coaching commercial qui analyse 100 % des appels en français."
          maxLength={MAX_LEN}
          rows={3}
          disabled={!canEdit || pending}
        />
      </div>

      <div className="space-y-2">
        <FieldHeader
          htmlFor="ai-competitors"
          label="Concurrents directs"
          value={values.competitors}
        />
        <Textarea
          id="ai-competitors"
          name="competitors"
          value={values.competitors}
          onChange={update("competitors")}
          placeholder="Ex. Modjo, Avoma, Gong (sur le segment enterprise)."
          maxLength={MAX_LEN}
          rows={3}
          disabled={!canEdit || pending}
        />
      </div>

      <div className="space-y-2">
        <FieldHeader
          htmlFor="ai-methodology"
          label="Méthodologie de vente (SPIN, BANT, MEDDIC, ou libre)"
          value={values.methodology}
        />
        <Input
          id="ai-methodology"
          name="methodology"
          type="text"
          value={values.methodology}
          onChange={update("methodology")}
          placeholder="Ex. MEDDIC"
          maxLength={MAX_LEN}
          disabled={!canEdit || pending}
          autoComplete="off"
        />
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
          {pending ? "Enregistrement…" : "Enregistrer le profil"}
        </Button>
      </div>

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">
          Seul le propriétaire de l&apos;organisation peut modifier le profil
          IA.
        </p>
      ) : null}
    </form>
  );
}
