// ============================================================================
// Section FAQ
// ============================================================================
// Les objections réelles entendues en prospection, traitées franchement — y
// compris celle qu'on n'a pas envie de lire (l'enregistrement des appels et le
// consentement). Mieux vaut la poser ici que la découvrir en démo.
//
// Implémenté avec <details>/<summary> natifs : accordéon accessible au clavier,
// zéro JavaScript côté client.
// ============================================================================

import { Plus } from "lucide-react";

import { CONTACT_EMAIL } from "@/lib/site";

import { DisplayTitle, Kicker, Section } from "./section";

const QUESTIONS = [
  {
    q: "Combien de temps pour brancher l'outil ?",
    a: "Une connexion par autorisation (OAuth) côté téléphonie ou visio, une autre côté CRM. Comptez une quinzaine de minutes avec nous en visio, et rien à installer sur les postes de vos commerciaux.",
  },
  {
    q: "Faut-il prévenir les personnes qu'on enregistre ?",
    a: "Oui. Aloalo analyse les enregistrements produits par votre téléphonie ou votre visio : l'information et le recueil du consentement des interlocuteurs relèvent de votre organisation, comme pour tout enregistrement d'appel. Nous vous aidons à cadrer la mention à ajouter, mais nous ne pouvons pas le faire à votre place.",
  },
  {
    q: "Que deviennent les enregistrements ?",
    a: "La référence à l'audio est supprimée de nos systèmes dans les 24 h suivant la transcription ; l'enregistrement d'origine reste chez votre fournisseur de téléphonie. Les transcriptions et analyses sont conservées 12 mois, sur des serveurs situés en Europe.",
  },
  {
    q: "Mes commerciaux vont-ils avoir l'impression d'être surveillés ?",
    a: "C'est la question la plus importante du déploiement. Aloalo est construit comme un outil de coaching : chaque constat est justifié par une citation, un brief 1:1 ne retient qu'un seul axe de travail, et le score global sur 100 a été retiré exprès. Le commercial y gagne d'abord du temps de saisie — c'est ce qui fait accepter le reste.",
  },
  {
    q: "Et si mon CRM ou ma téléphonie n'est pas dans la liste ?",
    a: "Dites-le nous. Le produit passe par une couche d'abstraction interne côté CRM comme côté source d'appel : ajouter un connecteur supplémentaire est un travail cadré, pas une réécriture. Nous priorisons selon les demandes des design partners.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Rien pendant le POC. Le produit sera facturé par abonnement mensuel, à un tarif pensé pour une PME et pas pour un grand compte ; nous le fixerons avec les premières équipes utilisatrices plutôt que dans notre coin.",
  },
];

export function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <Kicker>FAQ</Kicker>
          <DisplayTitle size="sm" className="mt-4 max-w-xs">
            Les questions qu&apos;on nous pose.
          </DisplayTitle>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            Il en manque une ?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
            >
              Écrivez-nous
            </a>
            , on répond nous-même.
          </p>
        </div>

        <div className="divide-y divide-foreground/10 border-y border-foreground/10">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[17px] leading-snug font-medium tracking-[-0.011em] outline-none focus-visible:underline focus-visible:underline-offset-4 [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus
                  className="mt-1 size-4 shrink-0 transition-transform group-open:rotate-45"
                  aria-hidden
                />
              </summary>
              <p className="mt-3 max-w-2xl pr-10 text-[15px] leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
