"use client";

// ============================================================================
// Éditeur des critères de sortie de phase (J28).
// ============================================================================
// Affiche, par pipeline, les PHASES OUVERTES du tunnel HubSpot avec leurs
// critères de sortie éditables (ajouter / reformuler / supprimer). Trois actions
// serveur : générer/régénérer TOUT, régénérer UNE phase, enregistrer l'édition
// d'UNE phase. Jamais une boîte noire : tout est visible et modifiable.
//
// Sync Next 16 : après une action serveur, l'action fait revalidatePath ET on
// fait router.refresh() (les deux nécessaires). Le piège : un état local figé
// par useState ne se resynchronise pas avec les nouvelles props serveur. On le
// règle en REMONTANT chaque StageBlock via une `key` dérivée des critères
// serveur → dès que le serveur renvoie de nouveaux critères (régénération,
// enregistrement), le bloc se réinitialise tout seul, sans actualisation manuelle.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Sparkles, X } from "lucide-react";

import {
  generateExitCriteria,
  saveExitCriteria,
} from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type EditorStage = {
  stageId: string;
  stageLabel: string;
  criteria: string[];
  aiGeneratedAt: string | null;
  editedAt: string | null;
};

export type EditorPipeline = {
  id: string;
  label: string;
  stages: EditorStage[];
};

const MAX_CRITERIA = 8;

export function ExitCriteriaEditor({
  pipelines,
  hasAnyCriteria,
}: {
  pipelines: EditorPipeline[];
  hasAnyCriteria: boolean;
}) {
  const router = useRouter();
  const [isGenerating, startGenerate] = useTransition();
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  function handleGenerateAll() {
    setGlobalMessage(null);
    startGenerate(async () => {
      const res = await generateExitCriteria();
      setGlobalMessage(res.ok ? res.message : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Barre d'action globale */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleGenerateAll}
          disabled={isGenerating}
          aria-live="polite"
        >
          <Sparkles className={isGenerating ? "size-4 animate-pulse" : "size-4"} />
          {isGenerating
            ? "Génération en cours…"
            : hasAnyCriteria
              ? "Régénérer avec l’IA"
              : "Proposer mes critères avec l’IA"}
        </Button>
        {hasAnyCriteria ? (
          <span className="text-xs text-muted-foreground">
            La régénération épargne les phases que vous avez modifiées à la main.
          </span>
        ) : null}
        {globalMessage ? (
          <span className="text-xs text-muted-foreground">{globalMessage}</span>
        ) : null}
      </div>

      {pipelines.map((p) => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle className="text-base">{p.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {p.stages.map((stage) => (
              // key dérivée du contenu serveur → remontage auto quand le serveur
              // renvoie de nouveaux critères (régénération / enregistrement).
              // Pendant une édition locale, le contenu serveur ne bouge pas →
              // la key reste stable → pas de remontage intempestif.
              <StageBlock
                key={`${stage.stageId}::${stage.criteria.join("§")}`}
                stage={stage}
                onChanged={() => router.refresh()}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StageBlock({
  stage,
  onChanged,
}: {
  stage: EditorStage;
  onChanged: () => void;
}) {
  const [isSaving, startSave] = useTransition();
  const [isRegenerating, startRegenerate] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Brouillon local, initialisé depuis les critères serveur. Le remontage par
  // `key` (côté parent) garantit la resynchro après toute action serveur.
  const [draft, setDraft] = useState<string[]>(() => [...stage.criteria]);

  const busy = isSaving || isRegenerating;

  // « Sale » = saisie/reformulation non encore enregistrée. (La suppression,
  // elle, s'enregistre immédiatement — cf. removeAt.)
  const dirty =
    draft.length !== stage.criteria.length ||
    draft.some((c, i) => c !== stage.criteria[i]);

  // Persiste une liste de critères pour cette phase (suppression immédiate ou
  // enregistrement explicite). Filtre les libellés vides avant envoi.
  function persist(list: string[]) {
    setMessage(null);
    startSave(async () => {
      const cleaned = list.map((c) => c.trim()).filter((c) => c.length > 0);
      const res = await saveExitCriteria(stage.stageId, cleaned);
      setMessage(res.ok ? res.message : res.error);
      if (res.ok) onChanged();
    });
  }

  function updateAt(i: number, value: string) {
    setDraft((d) => d.map((c, idx) => (idx === i ? value : c)));
  }

  // Suppression IMMÉDIATE : on enlève localement ET on enregistre tout de suite
  // (pas besoin de cliquer « Enregistrer »).
  function removeAt(i: number) {
    const next = draft.filter((_, idx) => idx !== i);
    setDraft(next);
    persist(next);
  }

  function addOne() {
    if (draft.length >= MAX_CRITERIA) return;
    setDraft((d) => [...d, ""]);
  }

  function handleRegenerate() {
    setMessage(null);
    startRegenerate(async () => {
      const res = await generateExitCriteria(stage.stageId);
      setMessage(res.ok ? res.message : res.error);
      if (res.ok) onChanged();
    });
  }

  const empty = draft.length === 0;

  return (
    <div className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{stage.stageLabel}</h3>
          {stage.editedAt ? (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
              modifié
            </span>
          ) : stage.aiGeneratedAt ? (
            <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] text-foreground">
              proposé par l’IA
            </span>
          ) : null}
        </div>
      </div>

      {empty ? (
        <p className="text-xs text-muted-foreground">
          Aucun critère. Utilisez « Proposer avec l’IA » ou ajoutez-en
          manuellement.
        </p>
      ) : (
        <ul className="space-y-2">
          {draft.map((label, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={label}
                maxLength={200}
                placeholder="ex. Budget confirmé"
                disabled={busy}
                onChange={(e) => updateAt(i, e.target.value)}
                aria-label={`Critère ${i + 1} de ${stage.stageLabel}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAt(i)}
                disabled={busy}
                aria-label="Supprimer ce critère"
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOne}
          disabled={busy || draft.length >= MAX_CRITERIA}
        >
          <Plus className="size-4" />
          Ajouter un critère
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={busy}
          aria-live="polite"
        >
          <RefreshCw
            className={isRegenerating ? "size-4 animate-spin" : "size-4"}
          />
          {isRegenerating ? "Régénération…" : "Régénérer"}
        </Button>
        {/* Enregistrer ne sert plus qu'à la saisie/reformulation : visible
            uniquement quand il y a du texte non enregistré. */}
        {dirty ? (
          <Button
            type="button"
            size="sm"
            onClick={() => persist(draft)}
            disabled={busy}
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        ) : null}
        {message ? (
          <span className="text-xs text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
