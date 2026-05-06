"use client";

import { ErrorCard } from "@/components/dashboard/error-card";

// Filet de sécurité pour /dashboard/calls. Activé si la requête paginée
// échoue (ex: filtre invalide, Supabase down).
export default function CallsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <ErrorCard
        error={error}
        reset={reset}
        title="Impossible de charger les appels"
        description="La liste des appels n'a pas pu être récupérée. Réessayez dans un instant."
      />
    </div>
  );
}
