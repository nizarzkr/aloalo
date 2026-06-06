"use client";

// ============================================================================
// CallTabs — navigation par onglets de la page d'analyse d'un appel (J21)
// ============================================================================
// Onglets accessibles (role tablist/tab/tabpanel) qui reçoivent leur contenu
// déjà rendu côté serveur (pattern Client wrappant des Server Components, comme
// CollapsibleSection). Tous les panneaux sont rendus puis masqués via `hidden`
// — bascule instantanée, aucun refetch. Un point orange signale un onglet qui
// contient une alerte (ex. dimension manquée, signal conversationnel).
// ============================================================================

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CallTab = {
  id: string;
  label: string;
  alert?: boolean; // pastille orange « à regarder »
  content: ReactNode;
};

export function CallTabs({
  tabs,
  defaultTabId,
}: {
  tabs: CallTab[];
  defaultTabId?: string;
}) {
  const [active, setActive] = useState(defaultTabId ?? tabs[0]?.id);

  return (
    <div>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              onClick={() => setActive(t.id)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                selected
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.alert ? (
                <span
                  aria-label="à surveiller"
                  className="size-1.5 rounded-full bg-orange-500"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          className="pt-6"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
