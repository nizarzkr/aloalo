"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Phone,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { logout } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/calls", label: "Appels", icon: Phone },
  { href: "/dashboard/team", label: "Équipe", icon: Users },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
];

// Évite que /dashboard reste actif quand on est sur /dashboard/calls.
function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type SidebarProps = {
  fullName: string;
  organizationName: string;
  email: string;
};

// Contenu de la sidebar — partagé entre desktop (fixe) et mobile (drawer).
function SidebarContent({
  fullName,
  organizationName,
  email,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const displayName = fullName.trim() || email;

  return (
    <>
      <div className="flex h-16 items-center px-6">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-xl font-bold tracking-tight text-transparent"
        >
          Aloalo
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar>
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {organizationName}
            </p>
          </div>
        </div>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" />
            Déconnexion
          </Button>
        </form>
      </div>
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Ferme automatiquement le drawer mobile quand on change de page.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Bloque le scroll du body quand le drawer mobile est ouvert.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  return (
    <>
      {/* Topbar mobile — visible uniquement < md, contient logo + hamburger */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-card px-4 md:hidden">
        <Link
          href="/dashboard"
          className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-lg font-bold tracking-tight text-transparent"
        >
          Aloalo
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={isOpen}
          aria-controls="mobile-sidebar"
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Sidebar desktop — fixe à gauche, ≥ md */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border/60 bg-card md:flex">
        <SidebarContent {...props} />
      </aside>

      {/* Drawer mobile — overlay plein écran, < md uniquement */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal>
          {/* Backdrop semi-transparent : clic = fermeture */}
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          {/* Panneau du drawer */}
          <aside
            id="mobile-sidebar"
            className="relative flex h-full w-72 max-w-[85%] flex-col border-r border-border/60 bg-card shadow-xl"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              aria-label="Fermer le menu"
              className="absolute top-3 right-3"
            >
              <X className="size-5" />
            </Button>
            <SidebarContent {...props} onNavigate={() => setIsOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
