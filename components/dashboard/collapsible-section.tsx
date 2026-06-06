"use client";

// ============================================================================
// CollapsibleSection — section rétractable à en-tête (icône + titre + sous-titre).
// ============================================================================
// Variante interactive de SectionHeading : l'en-tête est un bouton qui replie /
// déplie le contenu (chevron animé). Une `action` optionnelle (ex. bouton
// « Rafraîchir ») est rendue À CÔTÉ du bouton de repli, donc cliquer dessus ne
// replie pas la section.
//
// Reçoit `children` rendus côté serveur (pattern Client wrappant des Server
// Components) — utilisable directement dans une page Server Component.
// ============================================================================

import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  Gauge,
  Lightbulb,
  ListTodo,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Registre d'icônes résolu CÔTÉ CLIENT : on ne peut pas passer une fonction
// (composant icône) d'un Server Component vers ce composant client. On passe
// donc une clé string et on résout l'icône ici, où lucide est bundlé côté client.
const ICONS = {
  gauge: Gauge,
  lightbulb: Lightbulb,
  "list-todo": ListTodo,
  "messages-square": MessagesSquare,
} satisfies Record<string, LucideIcon>;

export function CollapsibleSection({
  icon,
  title,
  description,
  action,
  defaultOpen = true,
  children,
  className,
}: {
  icon: keyof typeof ICONS;
  title: string;
  description: string;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const Icon = ICONS[icon];
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("mb-12", className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group flex flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
              open ? "" : "-rotate-90",
            )}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              {title}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {description}
            </span>
          </span>
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {open ? children : null}
    </section>
  );
}
