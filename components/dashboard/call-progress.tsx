"use client";

// ============================================================================
// CallProgress — stepper de phase + auto-rafraîchissement (page détail)
// ============================================================================
// Tant que l'appel n'est pas terminé, interroge GET /api/calls/[id]/status
// toutes les ~3 s et fait avancer le stepper (Transcription → Analyse → Terminé)
// SANS recharger la page. Au passage en état terminal (analyzed/failed), il
// revalide le rendu serveur (revalidatePath via server action) puis le rafraîchit
// pour afficher l'analyse — les deux sont nécessaires en Next 16.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isTerminalStatus } from "@/lib/call-status";
import { revalidateCall } from "@/app/dashboard/calls/actions";

const POLL_MS = 3000;

const STEPS = [
  { key: "transcription", label: "Transcription" },
  { key: "analyse", label: "Analyse" },
  { key: "termine", label: "Terminé" },
] as const;

type StepState = "done" | "active" | "todo";

// Traduit le statut courant en état des 3 étapes + une légende.
function describe(status: string): { states: StepState[]; caption: string } {
  switch (status) {
    case "pending":
      return { states: ["active", "todo", "todo"], caption: "En file d'attente…" };
    case "transcribing":
      return {
        states: ["active", "todo", "todo"],
        caption: "Transcription de l'appel en cours…",
      };
    case "transcribed":
      return {
        states: ["done", "active", "todo"],
        caption: "Transcription terminée — lancement de l'analyse…",
      };
    case "analyzing":
      return { states: ["done", "active", "todo"], caption: "Analyse IA en cours…" };
    case "analyzed":
      return { states: ["done", "done", "done"], caption: "Analyse terminée." };
    default:
      return { states: ["active", "todo", "todo"], caption: "Traitement en cours…" };
  }
}

export function CallProgress({
  callId,
  initialStatus,
}: {
  callId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [, startTransition] = useTransition();
  // Évite de déclencher deux fois le refresh terminal (poll qui se chevauche).
  const finishedRef = useRef(false);

  useEffect(() => {
    if (isTerminalStatus(status)) return;
    let cancelled = false;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/calls/${callId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const { status: next } = (await res.json()) as { status?: string };
        if (cancelled || !next || next === status) return;

        setStatus(next); // fait avancer le stepper, sans recharger

        if (isTerminalStatus(next) && !finishedRef.current) {
          finishedRef.current = true;
          clearInterval(interval);
          // Côté serveur : invalide le cache RSC ; côté client : refetch.
          await revalidateCall(callId);
          startTransition(() => router.refresh());
        }
      } catch {
        // réseau : on retentera au prochain tick
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, callId, router]);

  const { states, caption } = describe(status);

  return (
    <Card className="p-2">
      <CardContent className="py-8">
        <div className="mx-auto flex max-w-md items-center">
          {STEPS.map((step, i) => {
            const state = states[i];
            const isLast = i === STEPS.length - 1;
            return (
              <div
                key={step.key}
                className={cn("flex items-center", !isLast && "flex-1")}
              >
                <div className="flex flex-col items-center gap-2">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 transition-colors",
                      state === "done" &&
                        "border-green-500 bg-green-500 text-white",
                      state === "active" &&
                        "border-foreground bg-background text-foreground",
                      state === "todo" &&
                        "border-border bg-background text-muted-foreground/50",
                    )}
                    aria-current={state === "active" ? "step" : undefined}
                  >
                    {state === "done" ? (
                      <Check className="size-4" aria-hidden />
                    ) : state === "active" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <span className="size-2 rounded-full bg-current" aria-hidden />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      state === "todo"
                        ? "text-muted-foreground"
                        : "text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {!isLast ? (
                  <span
                    className={cn(
                      "mx-2 mb-6 h-0.5 flex-1 rounded-full transition-colors",
                      states[i] === "done" ? "bg-green-500" : "bg-border",
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {caption}
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground/70">
          Cette page se met à jour automatiquement.
        </p>
      </CardContent>
    </Card>
  );
}
