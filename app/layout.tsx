import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* Vercel Analytics — actif uniquement en prod sur Vercel (no-op en dev). */}
        <Analytics />
      </body>
    </html>
  );
}
