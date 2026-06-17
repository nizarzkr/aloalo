"use client";

// ============================================================================
// Bouton « Pousser dans HubSpot » — Alerte Coaching actionnable (J26).
// ============================================================================
// Transforme une alerte (deal qui décroche) en tâche de suivi HubSpot, en 1 clic,
// via la Server Action `pushCoachingAction`. C'est le geste « l'IA agit ».
//
// Le serveur fait tout le travail sensible (recalcule l'alerte, résout la cible,
// crée la tâche, trace l'idempotence) ; ce composant ne gère que l'UI : état de
// chargement, message de retour, et bascule en « Poussé ✓ ».
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pushCoachingAction } from "@/app/dashboard/deals/actions";

type Props = {
  groupKey: string;
  // État initial connu côté serveur (lu dans deal_pushed_actions).
  alreadyPushed?: boolean;
  className?: string;
};

// Messages d'erreur lisibles selon le motif renvoyé par l'action.
const ERROR_MESSAGE: Record<string, string> = {
  not_connected: "Connectez HubSpot dans les Paramètres pour pousser l'action.",
  no_alert: "Ce deal ne décroche plus — rien à pousser.",
  no_target: "Aucun contact ou deal HubSpot lié à ce prospect.",
  hubspot_error: "HubSpot n'a pas répondu, réessayez dans un instant.",
  unauthorized: "Session expirée, reconnectez-vous.",
};

export function PushHubspotActionButton({
  groupKey,
  alreadyPushed = false,
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(alreadyPushed);
  const [message, setMessage] = useState<string | null>(null);

  function handlePush() {
    setMessage(null);
    startTransition(async () => {
      const result = await pushCoachingAction(groupKey);
      if (result.ok) {
        setDone(true);
        setMessage(
          result.already
            ? "Cette tâche était déjà dans HubSpot."
            : "Tâche de suivi créée dans HubSpot ✓",
        );
        // Refetch du rendu serveur (l'action a fait revalidatePath ; en Next 16
        // router.refresh() est aussi nécessaire pour ramener le nouveau rendu).
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
        Poussé dans HubSpot
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handlePush}
        disabled={isPending}
        aria-live="polite"
      >
        <Send className={isPending ? "size-4 animate-pulse" : "size-4"} />
        {isPending ? "Envoi…" : "Pousser dans HubSpot"}
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
