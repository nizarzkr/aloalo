// ============================================================================
// Hero
// ============================================================================
// Split asymétrique prévu par la DA : le texte à gauche (~55 %), l'objet à
// droite (~45 %). La DA place un rendu 3D à cet endroit — on n'a pas cet asset
// et on n'en fabrique pas un approximatif : c'est la réplique de l'écran
// d'appel analysé qui occupe la place. Le produit EST l'objet.
// ============================================================================

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMO_URL, INTEGRATIONS } from "@/lib/site";

import { DisplayTitle, Kicker, Marker } from "./section";
import { CallAnalysisMockup } from "./mockups/call-analysis";

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 pt-16 pb-20 sm:px-6 md:pt-24 md:pb-28">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:gap-10">
        <div className="min-w-0">
          <Kicker>Conversation intelligence · Hébergé en France</Kicker>

          <DisplayTitle as="h1" size="lg" className="mt-6">
            Vos appels commerciaux{" "}
            <Marker>se notent tout seuls.</Marker>
          </DisplayTitle>

          {/* Sous-titre en noir plein : la DA refuse le gris sur le hero. */}
          <p className="mt-7 max-w-lg text-lg leading-snug tracking-[-0.011em] text-pretty text-foreground md:text-xl">
            Aloalo transcrit et analyse chaque appel de votre équipe, pousse la
            note et les tâches de suivi dans votre CRM, et donne à vos managers
            de quoi coacher sur des faits plutôt que sur des impressions.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a
              href={DEMO_URL}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-6 text-base",
              )}
            >
              Réserver 15 min
            </a>
            <Link
              href="#produit"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 px-6 text-base",
              )}
            >
              Voir le produit
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs tracking-[-0.03em] text-muted-foreground">
            {INTEGRATIONS.map((integration, i) => (
              <li key={integration.name}>
                {i > 0 ? <span className="mr-2">·</span> : null}
                {integration.name}
              </li>
            ))}
          </ul>
        </div>

        {/* L'écran produit, dès le premier écran de la page. */}
        <div className="min-w-0 lg:-mr-4">
          <CallAnalysisMockup />
        </div>
      </div>
    </section>
  );
}
