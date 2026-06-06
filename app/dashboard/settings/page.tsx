// ============================================================================
// /dashboard/settings — redirige vers la 1re sous-page (Compte).
// ============================================================================
// Les réglages sont éclatés en sous-pages (account, billing, integrations,
// ai-profile, advanced). La racine renvoie vers Compte par défaut.
// ============================================================================

import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/dashboard/settings/account");
}
