import Stripe from "stripe";

// On épingle la version d'API Stripe : un `npm update` de `stripe` ne doit pas
// changer silencieusement le comportement de l'API (forme des réponses, etc.).
// Valeur reprise de l'ApiVersion du SDK installé (cf. issue #32). Typée en
// littéral via `const`, donc compatible avec le type attendu par StripeConfig
// (`apiVersion: LatestApiVersion`) sans cast.
const STRIPE_API_VERSION = "2026-04-22.dahlia";

// Server-only : ne jamais importer depuis un fichier "use client".
export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: STRIPE_API_VERSION,
  });
}
