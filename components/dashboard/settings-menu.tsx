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

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/settings/account", label: "Compte", icon: UserRound },
  { href: "/dashboard/settings/billing", label: "Facturation", icon: CreditCard },
  {
    href: "/dashboard/settings/integrations",
    label: "Intégrations",
    icon: Cable,
  },
  {
    href: "/dashboard/settings/exit-criteria",
    label: "Critères de sortie",
    icon: ListChecks,
  },
  { href: "/dashboard/settings/ai-profile", label: "Profil IA", icon: Sparkles },
  { href: "/dashboard/settings/advanced", label: "Avancé", icon: ShieldAlert },
];

export function SettingsMenu() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:sticky lg:top-8 lg:self-start"
      aria-label="Sections des réglages"
    >
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {ITEMS.map(({ href, label, icon: Icon }) => {
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
    </nav>
  );
}
