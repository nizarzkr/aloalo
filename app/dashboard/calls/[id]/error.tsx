"use client";

import { ErrorCard } from "@/components/dashboard/error-card";

// Filet de sécurité pour /dashboard/calls/[id]. Activé si la requête de
// détail plante. À NE PAS confondre avec not-found.tsx (appel inexistant).
export default function CallDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <ErrorCard
        error={error}
        reset={reset}
        title="Impossible de charger cet appel"
        description="Le détail de cet appel n'a pas pu être récupéré. Réessayez ou revenez à la liste."
      />
    </div>
  );
}
