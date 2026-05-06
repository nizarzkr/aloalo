import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { SkeletonBlock } from "@/components/dashboard/skeleton-card";
import { cn } from "@/lib/utils";

// Skeleton d'attente pour /dashboard/calls/[id]. Reprend le layout de la
// page détail : retour, header, score global, 5 sous-scores avec barres,
// puis transcript façon chat.
export default function CallDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      {/* Lien "Retour aux appels" */}
      <SkeletonBlock className="mb-6 h-4 w-32" />

      {/* Header appel : titre + date à gauche, badge à droite */}
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-64" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
        <SkeletonBlock className="h-6 w-20 rounded-full" />
      </header>

      {/* Score global */}
      <section className="mb-10 grid gap-6">
        <Card aria-busy>
          <CardHeader className="space-y-3">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-12 w-32" />
          </CardHeader>
        </Card>

        {/* 5 barres de progression (sous-scores par axe) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} size="sm" aria-busy>
              <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="h-4 w-12" />
                </div>
                {/* Barre de progression skeleton (h-2 = même hauteur que
                    le composant Progress de shadcn). */}
                <SkeletonBlock className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Transcript skeleton — bulles alternées gauche/droite */}
      <section className="mb-10">
        <Card aria-busy aria-live="polite">
          <CardHeader className="space-y-2">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-3 w-48" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => {
                const isCommercial = i % 2 === 0;
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex flex-col gap-1",
                      isCommercial ? "items-start" : "items-end",
                    )}
                  >
                    <SkeletonBlock className="h-3 w-24" />
                    <SkeletonBlock
                      className={cn(
                        "h-12 max-w-[80%] rounded-2xl",
                        isCommercial ? "w-72" : "w-64",
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
