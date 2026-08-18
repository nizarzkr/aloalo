// ============================================================================
// Nav du site vitrine — « pill » blanche flottante (DA refero)
// ============================================================================
// Pas de header pleine largeur : une pastille blanche posée sur le canvas gris,
// sans ombre ni bordure. Le contraste blanc-sur-gris suffit à la détacher.
//
// Sur mobile on ne replie pas les ancres dans un burger : la page est unique et
// courte à parcourir. On garde la marque + le seul CTA qui compte. Zéro JS.
// ============================================================================

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMO_CTA_LABEL, DEMO_URL, NAV_ITEMS } from "@/lib/site";

export function MarketingNav() {
  return (
    <div className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between gap-4 rounded-full bg-card pr-2 pl-5 sm:pl-6"
      >
        <Link
          href="/"
          className="font-heading text-xl font-bold tracking-tight text-foreground"
        >
          Aloalo
        </Link>

        <ul className="hidden items-center gap-7 lg:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-sm font-medium tracking-[-0.02em] text-[#444444] transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "hidden h-10 px-4 sm:inline-flex",
            )}
          >
            Connexion
          </Link>
          <a
            href={DEMO_URL}
            className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
          >
            {DEMO_CTA_LABEL}
          </a>
        </div>
      </nav>
    </div>
  );
}
