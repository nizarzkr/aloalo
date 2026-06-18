"use client";

// ============================================================================
// SettingsMenu — menu de navigation des sous-pages de Réglages (point 3 UX).
// ============================================================================
// Chaque entrée mène à une vraie route (/dashboard/settings/*). L'entrée active
// est déduite de l'URL courante (usePathname). Sur grand écran : colonne collante
// à gauche ; sur mobile : barre horizontale scrollable au-dessus du contenu.
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cable,
  CreditCard,
  ListChecks,
  ShieldAlert,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean; // masqué aux non-owners (cul-de-sac évité)
};

// Réglages regroupés par nature (J34) : Connexions / Intelligence / Mon compte.
// « Intelligence » = le cerveau du produit (sorti de l'ombre du jargon).
const GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Connexions",
    items: [
      {
        href: "/dashboard/settings/integrations",
        label: "Intégrations",
        icon: Cable,
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        href: "/dashboard/settings/ai-profile",
        label: "Contexte commercial",
        icon: Sparkles,
      },
      {
        href: "/dashboard/settings/exit-criteria",
        label: "Définition de la qualité",
        icon: ListChecks,
        ownerOnly: true,
      },
    ],
  },
  {
    title: "Mon compte",
    items: [
      { href: "/dashboard/settings/account", label: "Compte", icon: UserRound },
      {
        href: "/dashboard/settings/billing",
        label: "Facturation",
        icon: CreditCard,
        ownerOnly: true,
      },
      {
        href: "/dashboard/settings/advanced",
        label: "Avancé",
        icon: ShieldAlert,
      },
    ],
  },
];

export function SettingsMenu({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className="lg:sticky lg:top-8 lg:self-start"
      aria-label="Sections des réglages"
    >
      {/* Mobile : barre horizontale scrollable (sections aplaties). */}
      {/* Desktop : colonne avec titres de section. */}
      <div className="flex flex-col gap-4">
        {GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.ownerOnly || isOwner);
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 lg:block">
                {group.title}
              </p>
              <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
                {items.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
