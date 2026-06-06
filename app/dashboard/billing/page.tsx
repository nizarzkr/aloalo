// ============================================================================
// /dashboard/billing — redirige vers la sous-page Réglages › Facturation.
// ============================================================================
// La facturation a été déplacée sous /dashboard/settings/billing lors de la
// refonte des réglages en sous-pages. On garde cette route en redirection pour
// ne casser aucun lien externe en cache (URLs de retour Stripe notamment) ;
// on préserve le paramètre `?success=true` du retour de Checkout.
// ============================================================================

import { redirect } from "next/navigation";

export default async function BillingRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { success } = await searchParams;
  redirect(
    `/dashboard/settings/billing${success === "true" ? "?success=true" : ""}`,
  );
}
