"use client";

// ============================================================================
// Bouton « Rafraîchir le tunnel » — carte du tunnel HubSpot (J27).
// ============================================================================
// Relit la structure du tunnel (pipelines + stages) depuis HubSpot via la
// Server Action `refreshHubspotPipelines`, puis rafraîchit le rendu serveur.
// L'action fait le revalidatePath ; router.refresh() force le refetch côté
// client (les deux sont nécessaires en Next 16).
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { refreshHubspotPipelines } from "@/app/dashboard/settings/actions";

export function PipelineRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleRefresh() {
    setMessage(null);
    startTransition(async () => {
      const result = await refreshHubspotPipelines();
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isPending}
        aria-live="polite"
      >
        <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
        {isPending ? "Synchronisation…" : "Rafraîchir le tunnel"}
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </div>
  );
}
