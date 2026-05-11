// ============================================================================
// /privacy — Politique de confidentialité (RGPD)
// ============================================================================
// Document obligatoire (RGPD art. 13/14) : info aux personnes sur ce qu'on
// collecte, pourquoi, combien de temps, avec qui on partage, comment exercer
// leurs droits.
//
// Les placeholders [À COMPLÉTER] doivent être remplacés par les vraies infos
// avant ouverture commerciale.
// ============================================================================

import Link from "next/link";

export const metadata = {
  title: "Politique de confidentialité — Aloalo",
  description:
    "Comment Aloalo collecte, traite et protège vos données personnelles.",
};

const LAST_UPDATED = "11 mai 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : {LAST_UPDATED}
      </p>

      <div className="prose mt-10 max-w-none space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Qui est responsable du traitement ?</h2>
          <p>
            Aloalo (« nous ») est un service SaaS d&apos;analyse d&apos;appels
            commerciaux édité par&nbsp;:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>Nizar [NOM] — [FORME JURIDIQUE]</li>
            <li>Adresse&nbsp;: [ADRESSE COMPLÈTE]</li>
            <li>SIRET&nbsp;: [SIRET]</li>
            <li>Email&nbsp;: contact@aloalo.fr</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Quelles données collectons-nous ?</h2>
          <p>Dans le cadre du service Aloalo, nous traitons&nbsp;:</p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              <strong>Données de compte</strong>&nbsp;: email, nom complet, rôle
              (owner / manager / sales), organisation de rattachement.
            </li>
            <li>
              <strong>Enregistrements audio</strong> des appels téléphoniques
              issus de votre téléphonie (Ringover, Aircall). Les fichiers audio
              sont traités pour transcription puis la référence est supprimée de
              nos serveurs dans les 24h (cf. §4).
            </li>
            <li>
              <strong>Transcriptions textuelles</strong> et résultats
              d&apos;analyses IA (scores, conseils de coaching, résumés).
            </li>
            <li>
              <strong>Données techniques</strong>&nbsp;: logs d&apos;usage API,
              cookies de session, adresses IP des connexions.
            </li>
            <li>
              <strong>Données de facturation</strong>&nbsp;: plan souscrit,
              statut de l&apos;abonnement. Les données de carte bancaire sont
              gérées exclusivement par Stripe — nous n&apos;y avons jamais accès.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Sur quelles bases légales ?</h2>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              <strong>Exécution du contrat</strong> (art. 6.1.b RGPD) pour les
              données strictement nécessaires à la fourniture du service.
            </li>
            <li>
              <strong>Obligations légales</strong> (art. 6.1.c) pour les
              données de facturation conservées au titre du code de commerce.
            </li>
            <li>
              <strong>Intérêt légitime</strong> (art. 6.1.f) pour la sécurité
              du service (logs de connexion, détection d&apos;abus).
            </li>
          </ul>
          <p className="mt-2">
            Le contenu des appels analysés relève de l&apos;exécution du
            contrat conclu avec votre employeur (l&apos;organisation cliente
            Aloalo). Votre employeur est responsable de vous informer et le
            cas échéant de recueillir votre consentement à l&apos;enregistrement
            et à l&apos;analyse de ces conversations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Combien de temps gardons-nous vos données ?</h2>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              <strong>Fichiers audio</strong>&nbsp;: la référence est supprimée
              de nos systèmes dans les 24h suivant la transcription. L&apos;audio
              brut reste hébergé chez votre fournisseur de téléphonie (Ringover,
              Aircall) selon ses propres conditions.
            </li>
            <li>
              <strong>Transcriptions et analyses</strong>&nbsp;: 12 mois à
              compter de la date de l&apos;appel, puis suppression automatique.
            </li>
            <li>
              <strong>Logs techniques et logs d&apos;usage</strong>&nbsp;: 6
              mois.
            </li>
            <li>
              <strong>Données de compte</strong>&nbsp;: conservées tant que le
              compte est actif. Si vous êtes détaché de votre organisation,
              votre compte est supprimé automatiquement 90 jours après le
              détachement.
            </li>
            <li>
              <strong>Données de facturation</strong>&nbsp;: 10 ans (obligation
              comptable, art. L.123-22 code de commerce).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Avec qui partageons-nous vos données ?</h2>
          <p>
            Aloalo s&apos;appuie sur des sous-traitants techniques pour fournir
            le service. Tous présentent des garanties de conformité RGPD&nbsp;:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              <strong>Supabase</strong> (base de données, authentification) —
              hébergement en région West EU (Paris).
            </li>
            <li>
              <strong>AssemblyAI</strong> (transcription audio) — région UE.
            </li>
            <li>
              <strong>Anthropic</strong> (analyse IA des transcriptions, modèle
              Claude) — clauses contractuelles types pour transferts hors UE.
            </li>
            <li>
              <strong>Stripe</strong> (paiement) — paiement traité en UE,
              clauses contractuelles types pour la maison-mère US.
            </li>
            <li>
              <strong>Resend</strong> (emails transactionnels) — clauses
              contractuelles types.
            </li>
            <li>
              <strong>Vercel</strong> (hébergement applicatif) — frontend
              statique servi depuis l&apos;edge, données toujours stockées
              chez Supabase en UE.
            </li>
          </ul>
          <p className="mt-2">
            Aucune donnée n&apos;est revendue ni cédée à des tiers à des fins
            commerciales ou publicitaires.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Vos droits</h2>
          <p>Conformément aux art. 15 à 22 RGPD, vous disposez des droits suivants&nbsp;:</p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>droit d&apos;accès à vos données&nbsp;;</li>
            <li>droit de rectification&nbsp;;</li>
            <li>
              droit à l&apos;effacement («&nbsp;droit à l&apos;oubli&nbsp;»)
              — exerçable directement depuis votre espace
              <Link href="/dashboard/settings" className="ml-1 underline">
                Paramètres
              </Link>
              &nbsp;;
            </li>
            <li>droit à la limitation du traitement&nbsp;;</li>
            <li>droit à la portabilité de vos données&nbsp;;</li>
            <li>
              droit d&apos;opposition au traitement fondé sur l&apos;intérêt
              légitime.
            </li>
          </ul>
          <p className="mt-2">
            Pour toute demande, écrivez-nous à <strong>contact@aloalo.fr</strong>.
            Nous répondons sous un mois maximum. Vous avez par ailleurs le droit
            d&apos;introduire une réclamation auprès de la CNIL (www.cnil.fr).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Contact DPO</h2>
          <p>
            Bien que la désignation d&apos;un DPO ne soit pas obligatoire dans
            notre cas, le point de contact unique pour toute question liée à la
            protection des données est&nbsp;:
            <br />
            <strong>contact@aloalo.fr</strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Cookies</h2>
          <p>
            Aloalo n&apos;utilise que des cookies strictement nécessaires au
            fonctionnement du service (session d&apos;authentification). Aucun
            cookie publicitaire ou de mesure tierce n&apos;est déposé.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Mises à jour</h2>
          <p>
            Cette politique peut être mise à jour pour refléter des évolutions
            réglementaires ou fonctionnelles. La date de dernière mise à jour
            figure en haut de cette page. Les changements substantiels seront
            notifiés par email aux utilisateurs concernés.
          </p>
        </section>
      </div>
    </main>
  );
}
