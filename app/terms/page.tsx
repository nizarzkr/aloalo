// ============================================================================
// /terms — Conditions Générales d'Utilisation et de Vente
// ============================================================================
// CGU + CGV combinées (pratique fréquente en B2B SaaS pour éviter les
// doublons). Loi française applicable, juridiction Paris.
// ============================================================================

import Link from "next/link";

export const metadata = {
  title: "Conditions Générales — Aloalo",
  description: "Conditions Générales d'Utilisation et de Vente d'Aloalo.",
};

const LAST_UPDATED = "11 mai 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        Conditions Générales d&apos;Utilisation et de Vente
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : {LAST_UPDATED}
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Objet</h2>
          <p>
            Les présentes Conditions Générales (« CG ») régissent
            l&apos;utilisation du service Aloalo, un logiciel en mode SaaS
            d&apos;analyse de performance commerciale qui se connecte à votre
            outil de téléphonie (Ringover, Aircall) pour transcrire et
            analyser automatiquement vos appels.
          </p>
          <p className="mt-2">
            Toute souscription au service implique l&apos;acceptation pleine
            et entière des présentes CG.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Éditeur et coordonnées</h2>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>Aloalo — édité par Nizar [NOM]</li>
            <li>[FORME JURIDIQUE], SIRET [SIRET]</li>
            <li>Adresse&nbsp;: [ADRESSE COMPLÈTE]</li>
            <li>Email&nbsp;: contact@aloalo.fr</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Description du service</h2>
          <p>
            Aloalo fournit&nbsp;:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              connexion API à votre téléphonie pour récupérer les enregistrements
              d&apos;appels&nbsp;;
            </li>
            <li>
              transcription automatique par intelligence artificielle (diarisation
              incluse)&nbsp;;
            </li>
            <li>
              analyse IA de chaque appel&nbsp;: scores de performance par axe,
              conseils de coaching, résumés, identification des points forts et
              axes d&apos;amélioration&nbsp;;
            </li>
            <li>
              dashboard de pilotage par équipe et par commercial.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Plans tarifaires</h2>
          <p>Le service est commercialisé selon trois plans mensuels&nbsp;:</p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li><strong>Starter</strong>&nbsp;: 49&nbsp;€ HT / mois — jusqu&apos;à 100 appels analysés par mois.</li>
            <li><strong>Growth</strong>&nbsp;: 99&nbsp;€ HT / mois — jusqu&apos;à 500 appels analysés par mois.</li>
            <li><strong>Scale</strong>&nbsp;: 199&nbsp;€ HT / mois — jusqu&apos;à 2&nbsp;000 appels analysés par mois.</li>
          </ul>
          <p className="mt-2">
            Tous les prix sont exprimés hors taxes. La TVA française au taux en
            vigueur s&apos;applique aux clients établis en France. Les clients
            UE assujettis communiquant un numéro de TVA intracommunautaire
            valide sont facturés en autoliquidation. Une période d&apos;essai
            gratuite de 14 jours est offerte à toute nouvelle souscription.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Paiement</h2>
          <p>
            La facturation est mensuelle et automatique, prélevée par carte
            bancaire via notre prestataire Stripe. À défaut de paiement, le
            service peut être suspendu après un délai de 7 jours et un rappel
            par email.
          </p>
          <p className="mt-2">
            Le changement de plan (upgrade ou downgrade) est appliqué
            immédiatement, avec proratisation de la différence sur la prochaine
            facture.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Obligations du client</h2>
          <p>Le client s&apos;engage à&nbsp;:</p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              ne soumettre à Aloalo que des appels pour lesquels il dispose des
              autorisations nécessaires (information des interlocuteurs,
              consentement le cas échéant) conformément à la législation
              applicable&nbsp;;
            </li>
            <li>
              ne pas utiliser le service à des fins illicites, frauduleuses ou
              contraires aux bonnes mœurs&nbsp;;
            </li>
            <li>
              préserver la confidentialité de ses identifiants&nbsp;;
            </li>
            <li>
              ne pas tenter de contourner les limites techniques ou les quotas
              de son plan.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Propriété intellectuelle</h2>
          <p>
            Le client reste seul propriétaire de ses données (enregistrements,
            transcriptions, analyses). Aloalo dispose d&apos;une licence
            d&apos;usage strictement limitée à la fourniture du service.
          </p>
          <p className="mt-2">
            Le code, l&apos;interface, les algorithmes et la marque Aloalo
            demeurent la propriété exclusive de l&apos;éditeur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Disponibilité du service</h2>
          <p>
            Aloalo s&apos;engage à mettre en œuvre les moyens raisonnables pour
            garantir la disponibilité du service. Aucun engagement formel de SLA
            n&apos;est fourni en dehors d&apos;un avenant écrit. Des
            interruptions pour maintenance peuvent intervenir, idéalement
            annoncées 48h à l&apos;avance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Limitation de responsabilité</h2>
          <p>
            Aloalo fournit une aide à la décision basée sur des modèles
            d&apos;IA. Les scores et conseils générés sont indicatifs et ne
            sauraient se substituer au jugement humain. L&apos;éditeur ne
            pourra être tenu responsable des décisions prises par le client sur
            la base des résultats produits par le service.
          </p>
          <p className="mt-2">
            En tout état de cause, la responsabilité d&apos;Aloalo est limitée
            au montant des sommes effectivement perçues du client au titre des
            12 derniers mois précédant le fait générateur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Données personnelles</h2>
          <p>
            Le traitement des données personnelles est décrit dans notre&nbsp;
            <Link href="/privacy" className="underline">
              Politique de confidentialité
            </Link>
            , qui fait partie intégrante des présentes CG. Aloalo agit en tant
            que sous-traitant au sens du RGPD pour le contenu des appels et en
            tant que responsable de traitement pour les données de compte.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">11. Résiliation</h2>
          <p>
            Le client peut résilier son abonnement à tout moment depuis son
            espace
            <Link href="/dashboard/billing" className="ml-1 underline">
              Facturation
            </Link>
            . La résiliation prend effet à la fin de la période en cours et
            n&apos;ouvre pas droit à remboursement au prorata.
          </p>
          <p className="mt-2">
            Aloalo peut résilier le contrat avec préavis de 30 jours en cas de
            manquement grave du client (non-paiement, usage illicite, atteinte à
            la sécurité du service).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">12. Loi applicable et juridiction</h2>
          <p>
            Les présentes CG sont régies par le droit français. Tout litige
            relatif à leur interprétation ou exécution relève de la compétence
            exclusive des tribunaux du ressort de la Cour d&apos;appel de Paris,
            sauf disposition légale impérative contraire.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">13. Modification des CG</h2>
          <p>
            Aloalo se réserve le droit de modifier les présentes CG. Toute
            modification substantielle sera notifiée par email avec un préavis
            de 30 jours, ouvrant le droit de résilier sans frais avant
            application des nouvelles conditions.
          </p>
        </section>
      </div>
    </main>
  );
}
