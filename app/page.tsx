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
    title: "Transcription instantanée",
    description: "Chaque appel transcrit en français en moins de 60s.",
  },
  {
    icon: Sparkles,
    title: "Analyse IA Claude",
    description:
      "Score de performance, objections détectées, conseils personnalisés.",
  },
  {
    icon: Plug,
    title: "Native Ringover/Aircall",
    description:
      "Branchement en 5 minutes via webhook. Zero setup commercial.",
  },
];

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-xl font-bold tracking-tight text-transparent"
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
          <h1 className="text-4xl font-bold tracking-tight text-balance text-zinc-950 sm:text-5xl md:text-6xl">
            Votre IA écoute tous vos appels.
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Vous ne recevez que l&apos;essentiel.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-pretty text-zinc-600">
            Transcription, analyse et coaching automatique pour vos équipes
            commerciales. 100% RGPD, hébergé en France.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-6 text-base bg-gradient-to-r from-blue-600 to-violet-600 [a]:hover:from-blue-700 [a]:hover:to-violet-700 [a]:hover:bg-none"
              )}
            >
              Démarrer gratuitement
            </Link>
            <Link
              href="#demo"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 px-6 text-base"
              )}
            >
              Voir une démo
            </Link>
          </div>

          <div className="mt-6 text-sm text-zinc-500">
            ✓ 14 jours gratuits — Sans CB
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-32">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="p-2">
                <CardHeader>
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-violet-50 ring-1 ring-blue-100">
                    <Icon className="size-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
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
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-500 sm:flex-row">
          <p>© 2026 Aloalo</p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-zinc-900">
              Confidentialité
            </Link>
            <Link href="/terms" className="hover:text-zinc-900">
              CGU
            </Link>
            <Link href="/legal" className="hover:text-zinc-900">
              Mentions légales
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
