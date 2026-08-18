// ============================================================================
// Section « Le problème » — formulée par rôle (cf. BRIEF_GTM.md §2)
// ============================================================================
// Le visiteur doit se reconnaître avant qu'on lui parle de fonctionnalités.
// Ton mesuré, aucun chiffre inventé : on décrit une situation, on ne la vend
// pas.
// ============================================================================

import { DisplayTitle, Kicker, Section } from "./section";

const ROLES = [
  {
    role: "Le commercial",
    pain: "Prise de notes et mise à jour du CRM après chaque appel, au détriment du temps de vente. Et des next steps qui se perdent quand l'agenda se charge.",
  },
  {
    role: "Le manager",
    pain: "Peu de matière factuelle pour préparer un 1:1 : les chiffres de résultat et ce que le commercial rapporte — rarement ce qui s'est vraiment dit en appel.",
  },
  {
    role: "Le dirigeant",
    pain: "Un pipe qualifié de façon déclarative (« ce deal avance bien »), difficile à objectiver tant qu'on n'écoute pas les appels un par un.",
  },
];

export function Problem() {
  return (
    <Section>
      <Kicker>Le problème</Kicker>
      <DisplayTitle className="mt-5 max-w-3xl">
        L&apos;essentiel se joue à l&apos;oral. Puis ça disparaît.
      </DisplayTitle>

      <div className="mt-12 grid gap-px overflow-hidden rounded-[32px] bg-foreground/10 md:grid-cols-3">
        {ROLES.map((item) => (
          <div key={item.role} className="bg-card p-6 sm:p-8">
            <p className="font-heading text-2xl font-bold tracking-[-0.02em]">
              {item.role}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {item.pain}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-lg leading-snug tracking-[-0.011em] text-foreground">
        Une équipe de 5 à 50 commerciaux n&apos;a généralement ni Rev Ops dédié,
        ni temps de coaching structuré. Ce sont des fonctions qu&apos;on aimerait
        avoir, mais qu&apos;on ne peut pas encore internaliser.
      </p>
    </Section>
  );
}
