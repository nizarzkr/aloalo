// ============================================================================
// CTA final
// ============================================================================
// Seul endroit de la page où le jaune apparaît : la DA le réserve aux moments
// qui doivent arrêter l'œil. Un seul, en fin de parcours.
// ============================================================================

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTACT_EMAIL, DEMO_URL } from "@/lib/site";

import { DisplayTitle, Kicker, Marker, Panel, Section } from "./section";

export function FinalCta() {
  return (
    <Section className="pb-12 md:pb-20">
      <Panel className="text-center">
        <Kicker>Prochaine étape</Kicker>
        <DisplayTitle size="lg" className="mx-auto mt-6 max-w-3xl">
          Voyons ce que disent <Marker tone="yellow">vraiment</Marker> vos appels.
        </DisplayTitle>
        <p className="mx-auto mt-7 max-w-xl text-lg leading-snug tracking-[-0.011em] text-foreground">
          Quinze minutes, en visio, pour vous montrer le produit et voir s&apos;il
          a sa place dans votre équipe. S&apos;il n&apos;en a pas, on vous le
          dira.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={DEMO_URL}
            className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}
          >
            Réserver 15 min
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-12 px-6 text-base",
            )}
          >
            Poser une question
          </a>
        </div>
      </Panel>
    </Section>
  );
}
