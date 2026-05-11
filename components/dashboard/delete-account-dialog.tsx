"use client";

// ============================================================================
// Dialog de confirmation pour la suppression de compte RGPD.
// ============================================================================
// L'utilisateur doit taper littéralement "SUPPRIMER" pour confirmer, ce qui
// évite les clics accidentels. Une fois confirmé, on appelle DELETE
// /api/account et on redirige vers / (login détruit côté serveur).
// ============================================================================

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM_WORD = "SUPPRIMER";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = typed === CONFIRM_WORD && !loading;

  // Reset complet du state quand on ferme le dialog (annulation ou succès).
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTyped("");
      setError(null);
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Cas particulier : autres membres dans l'org → message dédié.
        if (res.status === 409) {
          throw new Error(
            data.message ??
              "Votre organisation a d'autres membres. Retirez-les d'abord.",
          );
        }
        throw new Error(data.error ?? "Erreur lors de la suppression");
      }
      // La session est révoquée côté serveur — redirection home.
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="destructive" />}>
        Supprimer mon compte
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer définitivement votre compte ?</DialogTitle>
          <DialogDescription>
            Cette action est <strong>irréversible</strong>. Toutes vos données
            seront effacées&nbsp;: appels, transcriptions, analyses,
            abonnement et organisation. Vous ne pourrez pas restaurer ce
            compte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Pour confirmer, tapez <strong>{CONFIRM_WORD}</strong>
          </Label>
          <Input
            id="confirm-delete"
            type="text"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
            disabled={loading}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={loading} />}>
            Annuler
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {loading ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
