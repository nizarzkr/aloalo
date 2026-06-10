"use client";

// ============================================================================
// Bouton « Relancer la transcription » — page détail d'un appel (issue #13).
// ============================================================================
// Relance la transcription d'un appel échoué via POST
// /api/calls/[id]/retry-transcription : la route remet l'appel en 'pending',
// efface error_message, puis re-déclenche /api/transcribe. La route fait le
// revalidatePath ; router.refresh() force le refetch côté client (les deux sont
// nécessaires en Next 16) pour que le stepper d'avancement (CallProgress)
// reprenne la main.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  callId: string;
};

export function RetryTranscriptionButton({ callId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/calls/${callId}/retry-transcription`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMessage(
          data?.error === "no_audio"
            ? "L'audio n'est plus disponible, relance impossible."
            : "Relance impossible pour le moment.",
        );
        return;
      }
      setMessage("Transcription relancée.");
      // Refetch du rendu serveur → le stepper d'avancement reprend la main.
      startTransition(() => router.refresh());
    } catch {
      setMessage("Relance impossible (réseau).");
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
        onClick={handleRetry}
        disabled={busy}
        aria-live="polite"
      >
        <RotateCcw className={busy ? "size-4 animate-spin" : "size-4"} />
        {busy ? "Relance…" : "Relancer la transcription"}
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </div>
  );
}
