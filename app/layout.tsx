import type { Metadata } from "next";
import { Inter, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { SITE_URL } from "@/lib/site";

import "./globals.css";

// Direction artistique « Swiss editorial » (Refero). Trois voix, trois rôles :
//   - Inter            → corps + UI (substitut de SuisseIntl)
//   - Barlow Condensed → gros titres condensés (substitut de SuisseIntlCond)
//   - JetBrains Mono   → tags / micro-labels 12px (substitut de SuisseIntlMono)
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Base absolue des métadonnées : sans elle, Next ne peut pas résoudre les
  // URLs relatives (canonical, image de partage) et prévient au build.
  metadataBase: new URL(SITE_URL),
  title: "Aloalo — L'IA qui écoute vos appels commerciaux",
  description:
    "Transcription, analyse et coaching automatique pour vos équipes commerciales. 100% RGPD, hébergé en France. Branchement Ringover & Aircall en 5 minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* Vercel Analytics — actif uniquement en prod sur Vercel (no-op en dev). */}
        <Analytics />
      </body>
    </html>
  );
}
