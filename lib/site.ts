// ============================================================================
// Constantes du site vitrine (route group `app/(marketing)`)
// ============================================================================
// Un seul endroit pour tout ce qui est susceptible de changer sans toucher au
// design : l'URL de prise de RDV, l'email de contact, les entrées de nav.
// ============================================================================

export const CONTACT_EMAIL = "contact@aloalo.fr";

// CTA principal du site : « Réserver une démo ».
// Tant qu'il n'y a pas d'agenda en ligne (Cal.com / Calendly), on retombe sur
// un mailto pré-rempli — c'est LA seule ligne à remplacer le jour où le lien
// existe (tous les boutons du site pointent ici).
export const DEMO_URL =
  `mailto:${CONTACT_EMAIL}` +
  "?subject=" +
  encodeURIComponent("Démo Aloalo — 15 minutes") +
  "&body=" +
  encodeURIComponent(
    "Bonjour,\n\n" +
      "Je souhaiterais voir Aloalo en démo.\n\n" +
      "Entreprise :\n" +
      "Nombre de commerciaux :\n" +
      "Téléphonie utilisée (Ringover / Aircall / autre) :\n" +
      "CRM utilisé (HubSpot / Pipedrive / autre) :\n\n" +
      "Merci !",
  );

export const DEMO_CTA_LABEL = "Réserver 15 min";

// Ancres de la page unique. L'ordre définit celui du menu.
export const NAV_ITEMS = [
  { href: "#produit", label: "Le produit" },
  { href: "#partis-pris", label: "Partis pris" },
  { href: "#integrations", label: "Intégrations" },
  { href: "#securite", label: "Sécurité" },
  { href: "#faq", label: "FAQ" },
] as const;

// Les 5 sources et destinations branchées aujourd'hui (cf. BRIEF_GTM.md §8).
export const INTEGRATIONS = [
  { name: "Ringover", kind: "Téléphonie" },
  { name: "Aircall", kind: "Téléphonie" },
  { name: "Google Meet", kind: "Visio" },
  { name: "HubSpot", kind: "CRM" },
  { name: "Pipedrive", kind: "CRM" },
] as const;

// URL absolue du site — nécessaire aux métadonnées (OG, canonical, sitemap).
// On réutilise NEXT_PUBLIC_APP_URL (déjà posée sur Vercel pour les liens
// d'invitation) plutôt que d'introduire une variable de plus.
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
