// ============================================================================
// Section « Sécurité & RGPD »
// ============================================================================
// Argument de réassurance n°1 sur le marché français, et vraie différence face
// aux acteurs américains. Chaque affirmation ici doit rester alignée sur
// /privacy — c'est le même engagement, pas une version marketing.
// ============================================================================

import Link from "next/link";

import { DisplayTitle, Kicker, Section } from "./section";

const FACTS = [
  {
    title: "Hébergement en Europe",
    body: "Base de données à Paris, transcription sur des serveurs européens. Vos conversations ne transitent pas hors de l'Union européenne.",
  },
  {
    title: "Audio non conservé",
    body: "La référence au fichier audio est supprimée de nos systèmes dans les 24 h suivant la transcription. L'enregistrement d'origine reste chez votre téléphonie.",
  },
  {
    title: "Cloisonnement par organisation",
    body: "Chaque société ne voit que ses propres données, garanti au niveau de la base elle-même et pas seulement dans l'application.",
  },
  {
    title: "Accès tiers chiffrés",
    body: "Les autorisations vers votre téléphonie et votre CRM sont chiffrées au repos. Elles restent révocables à tout moment de votre côté.",
  },
];

export function Security() {
  return (
    <Section id="securite">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <div>
          <Kicker>Sécurité & RGPD</Kicker>
          <DisplayTitle className="mt-5 max-w-md">
            Des conversations clients. Traitées comme telles.
          </DisplayTitle>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Vous confiez à Aloalo ce que vos clients vous disent. Les durées de
            conservation, les sous-traitants et vos droits sont écrits noir sur
            blanc, pas cachés dans une annexe.
          </p>
          <Link
            href="/privacy"
            className="mt-6 inline-block text-[15px] font-medium underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
          >
            Lire la politique de confidentialité
          </Link>
        </div>

        <ul className="grid gap-px overflow-hidden rounded-[32px] bg-foreground/10 sm:grid-cols-2">
          {FACTS.map((fact) => (
            <li key={fact.title} className="bg-card p-6 sm:p-7">
              <p className="font-heading text-xl font-bold tracking-[-0.02em]">
                {fact.title}
              </p>
              <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
                {fact.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
