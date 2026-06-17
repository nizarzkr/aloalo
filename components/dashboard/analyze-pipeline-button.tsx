"use client";

// ============================================================================
// AnalyzePipelineButton (J31) — déclenche le calcul d'hygiène de tous les deals.
// ============================================================================
// Les rapports d'hygiène sont normalement frais (pipeline J30 après chaque
// analyse). Ce bouton sert au PREMIER passage / aux deals analysés avant J30 :
// il appelle refreshOrgHygiene() qui recalcule chaque deal (le cache évite de
// re-payer l'IA). Réservé owner/manager côté serveur.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { refreshOrgHygiene } from "@/app/dashboard/deals/actions";

export function AnalyzePipelineButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await refreshOrgHygiene();
      if (result.ok) {
        setMessage(
          `Pipeline analysé — ${result.computed} deal${result.computed > 1 ? "s" : ""} passé${result.computed > 1 ? "s" : ""} au crible.`,
        );
        router.refresh();
      } else {
        setMessage("Action réservée aux managers.");
      }
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={isPending}
        aria-live="polite"
      >
        <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
        {isPending ? "Analyse…" : "Analyser le pipeline"}
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </div>
  );
}
