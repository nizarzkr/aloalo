"use client";

// ============================================================================
// Bouton « Corriger dans HubSpot » — écart d'hygiène actionnable (J31).
// ============================================================================
// Transforme UN écart d'hygiène (J30) en tâche de correction HubSpot, en 1 clic,
// via la Server Action `pushHygieneFix`. Calqué sur PushHubspotActionButton
// (J26) : le serveur fait tout le travail sensible (recalcule l'hygiène, résout
// la cible, crée la tâche, trace l'idempotence) ; ce composant ne gère que l'UI.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pushHygieneFix } from "@/app/dashboard/deals/actions";
import type { HygieneGapType } from "@/lib/hygiene/types";

type Props = {
  groupKey: string;
  gapType: HygieneGapType;
  // État initial connu côté serveur (lu dans deal_pushed_actions).
  alreadyPushed?: boolean;
  className?: string;
};

const ERROR_MESSAGE: Record<string, string> = {
  not_connected: "Connectez HubSpot dans les Paramètres pour corriger.",
  no_gap: "Cet écart n'est plus détecté — rien à corriger.",
  no_target: "Aucun contact ou deal HubSpot lié à ce prospect.",
  hubspot_error: "HubSpot n'a pas répondu, réessayez dans un instant.",
  unauthorized: "Session expirée, reconnectez-vous.",
};

export function PushHygieneFixButton({
  groupKey,
  gapType,
  alreadyPushed = false,
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(alreadyPushed);
  const [message, setMessage] = useState<string | null>(null);

  function handleFix() {
    setMessage(null);
    startTransition(async () => {
      const result = await pushHygieneFix(groupKey, gapType);
      if (result.ok) {
        setDone(true);
        setMessage(
          result.already
            ? "Cette correction était déjà dans HubSpot."
            : "Tâche de correction créée dans HubSpot ✓",
        );
        // revalidatePath côté action + router.refresh (les deux en Next 16).
        router.refresh();
      } else {
        setMessage(ERROR_MESSAGE[result.reason] ?? "Action impossible.");
      }
    });
  }

  if (done) {
    return (
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium text-emerald-700",
          className,
        )}
      >
        <Check className="size-3.5" aria-hidden />
        Corrigé dans HubSpot
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleFix}
        disabled={isPending}
        aria-live="polite"
      >
        <Wrench className={isPending ? "size-4 animate-pulse" : "size-4"} />
        {isPending ? "Envoi…" : "Corriger dans HubSpot"}
      </Button>
      {message ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CircleAlert className="size-3 shrink-0" aria-hidden />
          {message}
        </span>
      ) : null}
    </div>
  );
}
