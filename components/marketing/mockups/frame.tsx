// ============================================================================
// Frame — cadre « application » autour des répliques d'écrans
// ============================================================================
// Ces répliques ne sont PAS des captures : ce sont des composants qui utilisent
// les mêmes primitives (`components/ui/*`) et les mêmes tokens que le produit
// réel. Elles restent donc fidèles quand le design évolue.
//
// Règles communes à toutes les répliques :
//  - données 100 % fictives (Acme Corp / Camille Roux, cf. le simulateur) ;
//  - `aria-hidden` + `pointer-events-none` : décoratives, jamais cliquables,
//    et invisibles pour un lecteur d'écran (le texte de la section porte le
//    sens) ;
//  - intérieur sur le canvas gris avec des cartes blanches, exactement comme
//    le dashboard.
// ============================================================================

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const SIDEBAR_ITEMS = [
  "Accueil",
  "Pipeline",
  "Mon équipe",
  "Préparer un 1:1",
  "À faire",
  "Mes appels",
];

export function Frame({
  label,
  activeItem,
  className,
  children,
}: {
  /** Fil d'ariane affiché dans la barre du cadre. */
  label: string;
  /** Entrée de la sidebar mise en surbrillance. */
  activeItem?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 select-none",
        className,
      )}
    >
      {/* Barre de fenêtre */}
      <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-2.5">
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="ml-2 truncate font-mono text-[11px] tracking-[-0.03em] text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="flex bg-background">
        {/* Rail de navigation — masqué sous md pour laisser la place au contenu */}
        <div className="hidden w-40 shrink-0 flex-col gap-0.5 border-r border-foreground/10 bg-card p-2 md:flex">
          {SIDEBAR_ITEMS.map((item) => (
            <span
              key={item}
              className={cn(
                "truncate rounded-md px-2.5 py-1.5 text-xs",
                item === activeItem
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}
