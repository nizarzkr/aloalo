// ============================================================================
// Footer du site vitrine
// ============================================================================
// Sobre : marque, une ligne de positionnement, les liens légaux existants
// (/privacy, /terms, /legal) et le contact. Pas de « sitemap » gonflé sur une
// page unique.
// ============================================================================

import Link from "next/link";

import { CONTACT_EMAIL } from "@/lib/site";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Confidentialité" },
  { href: "/terms", label: "CGU" },
  { href: "/legal", label: "Mentions légales" },
];

export function MarketingFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-6">
      <div className="flex flex-col gap-6 border-t border-foreground/10 pt-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-heading text-lg font-bold tracking-tight">Aloalo</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Conversation intelligence pour les équipes commerciales françaises.
            Données hébergées en Europe.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="transition-colors hover:text-foreground"
            >
              {CONTACT_EMAIL}
            </a>
          </nav>
          <p className="font-mono text-xs tracking-[-0.03em] text-muted-foreground">
            © {new Date().getFullYear()} Aloalo
          </p>
        </div>
      </div>
    </footer>
  );
}
