// ============================================================================
// Layout des Réglages — menu de sous-pages persistant + zone de contenu.
// ============================================================================
// Partagé par toutes les routes /dashboard/settings/* (account, billing,
// integrations, ai-profile, advanced). Le menu (SettingsMenu) reste affiché ;
// seule la zone {children} change selon la sous-page.
// ============================================================================

import type { ReactNode } from "react";

import { SettingsMenu } from "@/components/dashboard/settings-menu";

export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez votre compte, votre organisation et vos intégrations.
        </p>
      </header>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[200px_1fr]">
        <SettingsMenu />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
