import Link from "next/link";
import { Mic, Sparkles, Plug } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Mic,
    kicker: "01 — Transcription",
    title: "Transcription instantanée",
    description: "Chaque appel transcrit en français en moins de 60s.",
  },
  {
    icon: Sparkles,
    kicker: "02 — Analyse",
    title: "Analyse IA Claude",
    description:
      "Score de performance, objections détectées, conseils personnalisés.",
  },
  {
    icon: Plug,
    kicker: "03 — Intégration",
    title: "Native Ringover/Aircall",
    description:
      "Branchement en 5 minutes via webhook. Zéro setup commercial.",
  },
];

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="font-heading text-xl font-bold tracking-tight text-foreground"
          >
            Aloalo
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
          >
            Connexion
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 pb-32 text-center sm:pt-32">
          {/* Kicker mono — signature typographique du système. */}
          <p className="font-mono text-xs tracking-tight text-muted-foreground uppercase">
            Intelligence commerciale · 100% RGPD
          </p>
          {/* Titre display condensé (Barlow), line-height serré, tracking tight. */}
          <h1 className="mt-5 font-heading text-5xl leading-[0.95] font-bold tracking-[-0.02em] text-balance text-foreground sm:text-6xl md:text-7xl">
            Votre IA écoute tous vos appels.
            <br className="hidden sm:block" />{" "}
            {/* Surlignage menthe — l'unique accent chromatique (façon marqueur). */}
            <span className="box-decoration-clone bg-mint px-2 text-foreground">
              Vous ne recevez que l&apos;essentiel.
            </span>
          </h1>
          {/* Sous-titre : noir plein (poids éditorial), pas de gris. */}
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-foreground">
            Transcription, analyse et coaching automatique pour vos équipes
            commerciales. Hébergé en France.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}
            >
              Démarrer gratuitement
            </Link>
            <Link
              href="#demo"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 px-6 text-base",
              )}
            >
              Voir une démo
            </Link>
          </div>

          <div className="mt-6 font-mono text-xs tracking-tight text-muted-foreground">
            ✓ 14 jours gratuits — Sans CB
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-32">
          <p className="mb-8 font-mono text-xs tracking-tight text-muted-foreground uppercase">
            Ce que fait Aloalo
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, kicker, title, description }) => (
              <Card key={title} className="p-2">
                <CardHeader>
                  {/* Pastille d'icône plate, lavis mist + icône noire (pas de couleur). */}
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-secondary">
                    <Icon className="size-5 text-foreground" />
                  </div>
                  <p className="font-mono text-[11px] tracking-tight text-muted-foreground uppercase">
                    {kicker}
                  </p>
                  <CardTitle className="mt-1 text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-[15px] leading-relaxed">
                    {description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© 2026 Aloalo</p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-foreground">
              Confidentialité
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              CGU
            </Link>
            <Link href="/legal" className="hover:text-foreground">
              Mentions légales
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
