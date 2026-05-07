"use client";

// ============================================================================
// Bannière "Abonnement activé !" — auto-dismiss après 3s + clean URL
// ============================================================================
// On rend cette bannière uniquement si ?success=true. Au mount on lance un
// timer 3s qui la masque et retire le query param de l'URL pour éviter qu'un
// refresh manuel la fasse réapparaître.
// ============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function BillingSuccessBanner() {
  const [visible, setVisible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      // Remplace l'URL sans ?success=true (history.replaceState, pas de refetch).
      router.replace("/dashboard/billing", { scroll: false });
    }, 3000);
    return () => clearTimeout(t);
  }, [router]);

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 transition-opacity">
      Abonnement activé ! Merci 🎉
    </div>
  );
}
