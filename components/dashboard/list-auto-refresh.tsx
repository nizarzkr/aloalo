"use client";

// ============================================================================
// ListAutoRefresh — moteur (invisible) de rafraîchissement d'une liste d'appels
// ============================================================================
// Reçoit du serveur la SIGNATURE des appels en cours + un flag `active`. Tant
// qu'il y a de l'activité, interroge GET /api/calls/activity toutes les ~4 s ;
// dès que la signature change (un appel a avancé/terminé), il revalide le rendu
// serveur (server action passée en prop, propre à la page) puis rafraîchit → les
// badges de la liste se mettent à jour seuls. S'arrête quand plus rien n'est en
// cours. Ne rend RIEN : le signal de chargement vit dans les badges.
// ============================================================================

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 4000;
// Plafond de durée : on cesse d'interroger /api/calls/activity au-delà (un appel
// bloqué ne doit pas faire poller un onglet oublié à vie). Un refresh/navigation
// relance le cycle.
const MAX_POLL_MS = 8 * 60 * 1000; // ~8 min

export function ListAutoRefresh({
  signature,
  active,
  onRevalidate,
}: {
  signature: string;
  active: boolean;
  // Server action propre à la page (revalide /dashboard/calls ou /dashboard).
  onRevalidate: () => Promise<void>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const busyRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const startedAt = Date.now();

    const interval = setInterval(async () => {
      if (busyRef.current) return;
      // Onglet caché : pas de poll (ni réseau ni fonction Vercel).
      if (document.hidden) return;
      // Plafond atteint : on s'arrête (un refresh/navigation relance le cycle).
      if (Date.now() - startedAt > MAX_POLL_MS) {
        clearInterval(interval);
        return;
      }
      busyRef.current = true;
      try {
        const res = await fetch("/api/calls/activity", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as { signature?: string };
        if (cancelled || next.signature === undefined) return;
        if (next.signature !== signature) {
          clearInterval(interval);
          await onRevalidate();
          startTransition(() => router.refresh());
        }
      } catch {
        // réseau : on retentera au prochain tick
      } finally {
        busyRef.current = false;
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [signature, active, onRevalidate, router]);

  return null;
}
