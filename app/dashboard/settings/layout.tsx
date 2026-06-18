// ============================================================================
// Layout des Réglages — menu de sous-pages persistant + zone de contenu.
// ============================================================================
// Partagé par toutes les routes /dashboard/settings/* (account, billing,
// integrations, ai-profile, advanced). Le menu (SettingsMenu) reste affiché ;
// seule la zone {children} change selon la sous-page.
// ============================================================================

import type { ReactNode } from "react";

import { SettingsMenu } from "@/components/dashboard/settings-menu";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Rôle du user → gating du menu (les entrées owner-only sont masquées pour les
  // non-owners afin d'éviter les culs-de-sac, ex. exit-criteria redirige déjà).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isOwner = profile?.role === "owner";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez votre compte, votre organisation et vos intégrations.
        </p>
      </header>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[220px_1fr]">
        <SettingsMenu isOwner={isOwner} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
