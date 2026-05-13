"use client";

// ============================================================================
// Bouton « Copier » — wrapper minimal autour de l'API Clipboard.
// ============================================================================
// Isolé en client component pour ne pas alourdir la page settings (qui reste
// majoritairement un Server Component). Affiche un feedback « Copié ! »
// éphémère pour rassurer le user que le clic a bien marché.
// ============================================================================

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  label?: string;
};

export function CopyButton({ value, label = "Copier" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // Reset au bout de 2s pour permettre une seconde copie.
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Cas exotique (navigateur trop vieux / contexte non sécurisé) — on
      // ne casse pas l'UI, on laisse simplement le bouton inerte.
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check className="size-4" />
          Copié&nbsp;!
        </>
      ) : (
        <>
          <Copy className="size-4" />
          {label}
        </>
      )}
    </Button>
  );
}
