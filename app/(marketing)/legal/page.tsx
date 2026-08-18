// ============================================================================
// /legal — Mentions légales
// ============================================================================
// Obligation LCEN (Loi pour la Confiance dans l'Économie Numérique, 2004).
// Tout site internet édité par un professionnel doit afficher l'identité
// précise de l'éditeur, du directeur de la publication et de l'hébergeur.
// ============================================================================

import Link from "next/link";

export const metadata = {
  title: "Mentions légales — Aloalo",
  description:
    "Mentions légales d'Aloalo : éditeur, directeur de publication, hébergeur.",
};

const LAST_UPDATED = "11 mai 2026";

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">Mentions légales</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : {LAST_UPDATED}
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Éditeur du site</h2>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>Nom commercial&nbsp;: Aloalo</li>
            <li>Représentant légal&nbsp;: Nizar [NOM]</li>
            <li>Forme juridique&nbsp;: [FORME JURIDIQUE]</li>
            <li>Capital social&nbsp;: [CAPITAL SOCIAL] (si applicable)</li>
            <li>Adresse du siège&nbsp;: [ADRESSE COMPLÈTE]</li>
            <li>SIRET&nbsp;: [SIRET]</li>
            <li>RCS&nbsp;: [VILLE D&apos;IMMATRICULATION RCS] (si applicable)</li>
            <li>N° de TVA intracommunautaire&nbsp;: [TVA] (si assujetti)</li>
            <li>Email&nbsp;: contact@aloalo.fr</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Directeur de la publication</h2>
          <p>Nizar [NOM], en qualité de représentant légal de l&apos;éditeur.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Hébergement</h2>
          <p>L&apos;application Aloalo est hébergée sur les infrastructures suivantes&nbsp;:</p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              <strong>Front-end et logique applicative</strong>&nbsp;: Vercel
              Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis —
              vercel.com.
            </li>
            <li>
              <strong>Base de données et authentification</strong>&nbsp;:
              Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 —
              supabase.com. Région de stockage utilisée&nbsp;: West EU
              (Paris, France).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Contact</h2>
          <p>
            Pour toute question relative au site ou au service&nbsp;:
            <br />
            <strong>contact@aloalo.fr</strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble du contenu de ce site (textes, logos, code source,
            interface) est protégé par le droit d&apos;auteur et le droit des
            marques. Toute reproduction, représentation ou exploitation, totale
            ou partielle, sans autorisation préalable écrite de l&apos;éditeur,
            est interdite.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Liens connexes</h2>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              <Link href="/privacy" className="underline">
                Politique de confidentialité
              </Link>
            </li>
            <li>
              <Link href="/terms" className="underline">
                Conditions Générales d&apos;Utilisation et de Vente
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
