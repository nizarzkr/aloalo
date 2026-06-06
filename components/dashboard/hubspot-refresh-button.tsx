"use client";

// ============================================================================
// Bouton « Rafraîchir depuis HubSpot » — page détail d'un appel (J18bis).
// ============================================================================
// Re-déclenche l'enrichissement HubSpot de l'appel (nom du contact, entreprise,
// deal lié) via POST /api/calls/[id]/hubspot-refresh, puis rafraîchit le rendu
// serveur. La route fait le revalidatePath ; router.refresh() force le refetch
// côté client (les deux sont nécessaires en Next 16).
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  callId: string;
};

export function HubspotRefreshButton({ callId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/calls/${callId}/hubspot-refresh`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as {
        found?: boolean;
        error?: string;
      } | null;

      if (!res.ok) {
        // Messages courts et lisibles selon le motif d'échec connu.
        const reason =
          data?.error === "hubspot_not_connected"
            ? "HubSpot n'est pas connecté."
            : data?.error === "no_phone"
              ? "Cet appel n'a pas de numéro à rechercher."
              : "Rafraîchissement impossible pour le moment.";
        setMessage(reason);
        return;
      }

      setMessage(
        data?.found
          ? "Infos mises à jour depuis HubSpot."
          : "Aucun contact HubSpot trouvé pour ce numéro.",
      );
      // Refetch du rendu serveur pour afficher les nouvelles infos.
      startTransition(() => router.refresh());
    } catch {
      setMessage("Rafraîchissement impossible (réseau).");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || isPending;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={busy}
        aria-live="polite"
      >
        <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
        {busy ? "Rafraîchissement…" : "Rafraîchir depuis HubSpot"}
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </div>
  );
}
