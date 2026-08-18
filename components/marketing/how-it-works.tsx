// ============================================================================
// Section « Comment ça marche » — 4 étapes
// ============================================================================
// Répond à la seule question technique que se pose un dirigeant : « qu'est-ce
// que ça me demande, à moi ? ». Réponse : une connexion, puis plus rien.
// ============================================================================

import { DisplayTitle, Kicker, Panel, Section } from "./section";

const STEPS = [
  {
    n: "01",
    title: "L'appel a lieu",
    body: "Sur Ringover, Aircall ou Google Meet. Votre équipe ne change rien à ses habitudes, n'installe rien, ne lance rien.",
  },
  {
    n: "02",
    title: "Transcription en Europe",
    body: "L'enregistrement est transcrit en français, avec séparation des interlocuteurs. Traitement et stockage en Europe, sans transit hors UE.",
  },
  {
    n: "03",
    title: "Analyse sourcée",
    body: "L'IA évalue l'appel par dimensions et justifie chaque constat par une citation exacte. Les métriques de dynamique, elles, sont calculées sans IA.",
  },
  {
    n: "04",
    title: "Tout repart dans votre CRM",
    body: "Note de synthèse et tâches de suivi poussées sur le bon contact et le bon deal, dans HubSpot ou Pipedrive. Zéro saisie.",
  },
];

export function HowItWorks() {
  return (
    <Section>
      <Panel>
        <Kicker>Comment ça marche</Kicker>
        <DisplayTitle className="mt-5 max-w-2xl">
          Vous branchez une fois. Ensuite, ça tourne.
        </DisplayTitle>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step) => (
            <li key={step.n}>
              <p className="font-mono text-xs tracking-[-0.03em] text-muted-foreground">
                {step.n}
              </p>
              <p className="mt-3 font-heading text-2xl leading-[0.95] font-bold tracking-[-0.02em]">
                {step.title}
              </p>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Panel>
    </Section>
  );
}
