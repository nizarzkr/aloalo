// ============================================================================
// Section « Le produit » — les 3 actes (cf. BRIEF_GTM.md §4)
// ============================================================================
// Analyser / Piloter / Coacher : la même colonne vertébrale que la démo. Un
// acte = un rôle qui gagne quelque chose = un écran réel montré à côté.
// Les blocs alternent texte/écran pour tenir le rythme éditorial.
// ============================================================================

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { DisplayTitle, Kicker, Section } from "./section";
import { TodoMockup } from "./mockups/todo";
import { DealsMockup } from "./mockups/deals";
import { OneOnOneMockup } from "./mockups/one-on-one";

function Act({
  kicker,
  title,
  lead,
  points,
  benefit,
  visual,
  reverse = false,
}: {
  kicker: string;
  title: ReactNode;
  lead: string;
  points: string[];
  benefit: string;
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
      {/* min-w-0 : sans lui, les lignes en `truncate` des répliques (white-space:
          nowrap) imposent leur largeur à la piste de grille et débordent en mobile. */}
      <div className={cn("min-w-0", reverse && "lg:order-2")}>
        <Kicker>{kicker}</Kicker>
        <DisplayTitle size="sm" className="mt-4 max-w-md">
          {title}
        </DisplayTitle>
        <p className="mt-5 max-w-lg text-[17px] leading-snug tracking-[-0.011em] text-foreground">
          {lead}
        </p>

        <ul className="mt-6 space-y-2.5">
          {points.map((point) => (
            <li
              key={point}
              className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground"
            >
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" />
              {point}
            </li>
          ))}
        </ul>

        {/* La chute : ce que ça change concrètement, en une phrase. */}
        <p className="mt-6 max-w-lg border-l-2 border-foreground pl-4 text-[15px] leading-relaxed font-medium text-foreground">
          {benefit}
        </p>
      </div>

      <div className={cn("min-w-0", reverse && "lg:order-1")}>{visual}</div>
    </div>
  );
}

export function Acts() {
  return (
    <Section id="produit" className="space-y-24 md:space-y-32">
      <Act
        kicker="Acte 1 · Analyser"
        title="L'appel se note tout seul"
        lead="Dès que l'appel raccroche, la transcription part, l'analyse suit, et le commercial retrouve son travail déjà fait."
        points={[
          "Une note de synthèse rédigée pour lui, poussée dans le CRM sur le bon contact et le bon deal.",
          "Des tâches de suivi proposées avec une échéance contextualisée — pas un rappel générique — regroupées dans une file « À faire ».",
          "Une évaluation par dimensions (découverte, objections, next step…), chacune justifiée par une citation exacte de l'appel.",
        ]}
        benefit="Plus de temps administratif après l'appel, plus aucune relance oubliée — et pas une minute de saisie."
        visual={<TodoMockup />}
      />

      <Act
        reverse
        kicker="Acte 2 · Piloter"
        title="Un pipe qu'on peut enfin vérifier"
        lead="Ce qui s'est dit en appel devient une donnée de pilotage, au lieu de rester dans la tête du commercial."
        points={[
          "Le momentum d'un deal suivi appel après appel : progression, décrochage, et les raisons explicitées.",
          "Une hygiène de pipeline qui repère les écarts (deal bloqué sans raison, phase incohérente, next step manquant) et propose la correction en un clic.",
          "Une couche de fiabilité du forecast : les deals dont l'avancement déclaré n'est pas soutenu par ce qui s'est réellement dit.",
        ]}
        benefit="Repérer les deals qui se refroidissent avant de les perdre, sans réécouter les appels un par un."
        visual={<DealsMockup />}
      />

      <Act
        kicker="Acte 3 · Coacher"
        title="Coacher sur des faits, pas sur du ressenti"
        lead="Le manager arrive en 1:1 avec de la matière précise, tirée d'appels réels, et un seul axe de travail à la fois."
        points={[
          "Un briefing préparé avant l'entretien : ce qui progresse, les points récurrents, sur quoi insister — au ton bienveillant.",
          "Un profil de coaching par commercial, qui agrège ses tendances dans le temps.",
          "Des signaux comportementaux mesurés : questions ouvertes ou fermées, réaction au prix, gestion du silence après une objection.",
        ]}
        benefit="Des 1:1 préparés en deux minutes au lieu de trente, ancrés sur des moments précis plutôt que sur une impression."
        visual={<OneOnOneMockup />}
      />
    </Section>
  );
}
