// ============================================================================
// Site vitrine — page unique
// ============================================================================
// Un seul parcours de lecture : problème → produit (3 actes) → partis pris →
// intégrations → sécurité → offre → FAQ → CTA. Les sections sont dans
// `components/marketing/`, une par fichier, pour que chacune reste lisible.
//
// DA : « Swiss editorial » (refero/DESIGN.md). Canvas gris, cartes blanches
// flottantes, Barlow Condensed en display, aucun effet d'ombre.
// ============================================================================

import type { Metadata } from "next";

import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Acts } from "@/components/marketing/acts";
import { Principles } from "@/components/marketing/principles";
import { Integrations } from "@/components/marketing/integrations";
import { Security } from "@/components/marketing/security";
import { DesignPartner } from "@/components/marketing/design-partner";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "Aloalo — Vos appels commerciaux se notent tout seuls",
  description:
    "Aloalo transcrit et analyse les appels de vos commerciaux, pousse notes et tâches dans HubSpot ou Pipedrive, et donne à vos managers de quoi coacher sur des faits. Ringover, Aircall, Google Meet. Données hébergées en Europe.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Aloalo",
    title: "Aloalo — Vos appels commerciaux se notent tout seuls",
    description:
      "Conversation intelligence pour les PME françaises : transcription, analyse sourcée, notes et tâches dans votre CRM. Données hébergées en Europe.",
  },
};

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Acts />
      <Principles />
      <Integrations />
      <Security />
      <DesignPartner />
      <Faq />
      <FinalCta />
    </>
  );
}
