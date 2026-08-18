// ============================================================================
// Section « Programme design partner » — remplace la grille tarifaire
// ============================================================================
// Décision produit : tant que le prix n'est pas validé par le marché, on ne
// l'affiche pas. On vend un POC gratuit, et on est explicite sur la contrepartie
// attendue (du feedback) — c'est ce qui rend l'offre crédible plutôt que
// suspecte.
// ============================================================================

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMO_URL } from "@/lib/site";

import { DisplayTitle, Kicker, Panel, Section } from "./section";

const DEAL = [
  {
    side: "Ce que vous obtenez",
    items: [
      "L'accès complet au produit, gratuitement pendant tout le POC.",
      "Le branchement de votre téléphonie et de votre CRM fait avec vous.",
      "Une oreille directe sur la roadmap : ce qui vous manque passe en priorité.",
    ],
  },
  {
    side: "Ce qu'on vous demande",
    items: [
      "De l'utiliser pour de vrai, sur vos appels, pendant quelques semaines.",
      "Un point d'échange régulier pour nous dire ce qui sert et ce qui ne sert pas.",
      "Le droit de vous citer si l'expérience vous a plu — jamais sans votre accord.",
    ],
  },
];

export function DesignPartner() {
  return (
    <Section id="design-partner">
      <Panel>
        <div className="max-w-2xl">
          <Kicker>Programme design partner</Kicker>
          <DisplayTitle className="mt-5">
            On cherche quelques équipes, pas encore des clients.
          </DisplayTitle>
          <p className="mt-6 text-lg leading-snug tracking-[-0.011em] text-foreground">
            Aloalo est un produit jeune, construit avec les équipes qui
            l&apos;utilisent. Nous ouvrons donc un nombre limité de POC gratuits
            à des PME françaises de 5 à 50 commerciaux. Pas de carte bancaire,
            pas d&apos;engagement.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-[24px] bg-foreground/10 md:grid-cols-2">
          {DEAL.map((column) => (
            <div key={column.side} className="bg-card p-6 sm:p-8">
              <p className="font-mono text-[11px] tracking-[-0.03em] text-muted-foreground uppercase">
                {column.side}
              </p>
              <ul className="mt-4 space-y-3">
                {column.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-[15px] leading-relaxed text-foreground"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <a
            href={DEMO_URL}
            className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}
          >
            Réserver 15 min
          </a>
          <p className="font-mono text-xs tracking-[-0.03em] text-muted-foreground">
            Une visio de 15 minutes, sans slides — on ouvre le produit et on
            vous le montre écran par écran.
          </p>
        </div>
      </Panel>
    </Section>
  );
}
