"use client";

// ============================================================================
// Boutons billing — checkout (premier abo), change-plan (abo existant), portal.
// ============================================================================
// Le composant <PlanActionButton> décide automatiquement entre Checkout et
// Change-Plan selon que l'org a déjà une subscription Stripe ou pas.
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

type Mode = "checkout" | "change-plan";

export function PlanActionButton({
  priceId,
  planName,
  isCurrent,
  hasActiveSubscription,
}: {
  priceId: string;
  planName: string;
  isCurrent: boolean;
  hasActiveSubscription: boolean;
}) {
  if (isCurrent) {
    return (
      <Button type="button" variant="outline" disabled className="w-full">
        Plan actuel
      </Button>
    );
  }

  // Premier abonnement → Checkout. Abo existant → Change-Plan avec confirmation.
  const mode: Mode = hasActiveSubscription ? "change-plan" : "checkout";

  return mode === "change-plan" ? (
    <ChangePlanButton priceId={priceId} planName={planName} />
  ) : (
    <CheckoutButton priceId={priceId} />
  );
}

function CheckoutButton({ priceId }: { priceId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Erreur Checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="w-full"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Redirection…" : "Choisir ce plan"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function ChangePlanButton({
  priceId,
  planName,
}: {
  priceId: string;
  planName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Erreur changement de plan");
      }
      // Redirige vers une URL propre (sans ?success=true résiduel d'un
      // checkout précédent) plutôt que reload — évite que la bannière
      // "Abonnement activé" reste collée.
      window.location.href = "/dashboard/settings/billing";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" className="w-full" />}
      >
        Choisir ce plan
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passer au plan {planName} ?</DialogTitle>
          <DialogDescription>
            Stripe ajustera automatiquement la facturation : vous serez crédité
            du temps non consommé sur votre plan actuel et facturé au prorata du
            plan {planName} jusqu&apos;à la fin de la période en cours. La différence
            apparaîtra sur votre prochaine facture.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" disabled={loading} />}
          >
            Annuler
          </DialogClose>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Mise à jour…" : "Confirmer le changement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Erreur Portal");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Chargement…" : "Gérer mon abonnement"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
