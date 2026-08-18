// ============================================================================
// Primitives de mise en page du site vitrine — DA « Swiss editorial »
// ============================================================================
// Tout le rythme de la page passe par ces 5 briques, pour qu'aucune section ne
// parte en roue libre : conteneur, panneau blanc, kicker mono, titre display,
// surlignage menthe. Référence : refero/DESIGN.md.
// ============================================================================

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Conteneur de section : largeur max 1280px et respiration de 80px+ (la DA
// impose l'espace blanc comme séparateur — aucun filet, aucune bordure).
export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "mx-auto w-full max-w-[1280px] px-4 py-20 sm:px-6 md:py-32",
        // scroll-mt : compense la nav flottante quand on arrive par une ancre.
        id && "scroll-mt-28",
        className,
      )}
    >
      {children}
    </section>
  );
}

// Carte blanche surdimensionnée posée sur le canvas gris. C'est LA façon dont
// la DA sépare les couches : blanc sur gris, sans ombre ni bordure.
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[32px] bg-card p-6 sm:p-10 md:rounded-[64px] md:p-14",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Micro-voix mono 12px — la signature typographique du système.
export function Kicker({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "font-mono text-xs tracking-[-0.03em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

// Titre display : Barlow Condensed 700, interligne 0.9, tracking -3%.
// `level` ne change que la balise (hiérarchie a11y), pas le style.
export function DisplayTitle({
  as: Tag = "h2",
  size = "md",
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  const sizes = {
    sm: "text-3xl sm:text-4xl md:text-5xl",
    md: "text-4xl sm:text-5xl md:text-6xl",
    lg: "text-5xl sm:text-6xl md:text-7xl lg:text-[6.5rem]",
  } as const;

  return (
    <Tag
      className={cn(
        "font-heading font-bold text-balance text-foreground",
        "leading-[0.9] tracking-[-0.03em]",
        sizes[size],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Marker — surlignage menthe « coup de marqueur »
// ---------------------------------------------------------------------------
// Un `bg-mint` plein déborde sur la ligne du dessus : la boîte de fond d'un
// span inline fait ~1.25em de haut (ascendante + descendante de la police),
// alors que l'interligne display n'est que de 0.9em. Le fond mord donc la
// ligne précédente.
//
// On peint donc un dégradé à bornes fixes, calé sur les métriques RÉELLES de
// Barlow Condensed (mesurées : ascendante 1.00em, descendante 0.20em, donc une
// boîte de 1.20em ; hauteur de capitale 0.70em au-dessus de la ligne de base) :
//
//   bas du marqueur  : 0.05em au-dessus du bas de la boîte
//   haut du marqueur : 0.90em, soit exactement la hauteur des capitales
//
// Comme la boîte de 1.20em est centrée sur une ligne de 0.90em, elle dépasse de
// 0.15em de chaque côté. Ces deux bornes maintiennent donc le marqueur ENTIÈREMENT
// dans sa propre ligne (0.15em de marge en haut, 0.10em en bas) : il ne peut plus
// mordre sur la ligne du dessus, quel que soit l'endroit du retour à la ligne.
// Les jambages (g, p, q) dépassent légèrement en bas — c'est exactement l'effet
// d'un vrai coup de marqueur, et c'est ce que décrit la DA.
//
// `box-decoration-clone` : le marqueur se redessine proprement sur chaque
// ligne quand le texte passe à la ligne (sinon il s'étire d'un bloc).
//
// Quota DA : 2 surlignages maximum sur l'ensemble de la page.
const MARKER_BOTTOM = "0.05em";
const MARKER_TOP = "0.9em";

export function Marker({
  tone = "mint",
  children,
}: {
  /** Menthe = surlignage courant. Jaune = LE moment fort, une seule fois. */
  tone?: "mint" | "yellow";
  children: ReactNode;
}) {
  const color = tone === "yellow" ? "var(--yellow)" : "var(--mint)";
  return (
    <span
      className="box-decoration-clone px-[0.08em]"
      style={{
        backgroundImage:
          `linear-gradient(to top,` +
          ` transparent ${MARKER_BOTTOM}, ${color} ${MARKER_BOTTOM},` +
          ` ${color} ${MARKER_TOP}, transparent ${MARKER_TOP})`,
      }}
    >
      {children}
    </span>
  );
}
