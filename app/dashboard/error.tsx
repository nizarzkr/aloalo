"use client";

import { ErrorCard } from "@/components/dashboard/error-card";

// Filet de sécurité pour /dashboard. Activé si dashboard/page.tsx (ou un
// layout en-dessous) lance une exception côté serveur ou navigateur.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <ErrorCard error={error} reset={reset} />
    </div>
  );
}
