// ============================================================================
// Section « Partis pris » (cf. BRIEF_GTM.md §5)
// ============================================================================
// C'est la vraie différenciation face aux outils US : pas une liste de
// features, une façon de traiter le sujet. Elle mérite sa section, en gros
// caractères, sans illustration.
// ============================================================================

import { DisplayTitle, Kicker, Section } from "./section";

const PRINCIPLES = [
  {
    title: "Chaque constat est sourcé",
    body: "Une évaluation de l'IA s'appuie toujours sur une citation exacte de l'appel. Vérifiable, donc discutable — et donc utilisable en 1:1.",
  },
  {
    title: "L'IA propose, l'humain valide",
    body: "Sur les sujets structurants (critères de passage de phase, corrections de pipeline), Aloalo suggère et n'impose rien. Le responsable garde la main.",
  },
  {
    title: "On fiabilise, on ne devine pas",
    body: "Pas de forecast prédictif sorti d'un chapeau. Aloalo dit seulement si le forecast déjà présent dans votre CRM est soutenu par les appels réels.",
  },
  {
    title: "Sobriété assumée",
    body: "Un constat actionnable vaut mieux qu'une avalanche de KPIs. Le score global sur 100 a d'ailleurs été retiré, au profit d'évaluations lisibles.",
  },
];

export function Principles() {
  return (
    <Section id="partis-pris">
      <Kicker>Nos partis pris</Kicker>
      <DisplayTitle className="mt-5 max-w-3xl">
        Un outil d&apos;IA à qui on peut demander des comptes.
      </DisplayTitle>

      <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2">
        {PRINCIPLES.map((principle, i) => (
          <div key={principle.title} className="flex gap-5">
            <span className="font-mono text-xs tracking-[-0.03em] text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="font-heading text-3xl leading-[0.95] font-bold tracking-[-0.02em]">
                {principle.title}
              </p>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                {principle.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
