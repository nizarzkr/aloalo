import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { SkeletonBlock } from "@/components/dashboard/skeleton-card";

// Skeleton d'attente pour /dashboard/calls. Reprend le layout de la liste
// paginée : titre + total, barre de filtres (période / score), 8 lignes.
export default function CallsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      {/* Header titre + total */}
      <header className="mb-8 space-y-2">
        <SkeletonBlock className="h-7 w-32" />
        <SkeletonBlock className="h-4 w-40" />
      </header>

      {/* Barre de filtres : 2 selects + un bouton reset */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SkeletonBlock className="h-9 w-40 rounded-md" />
        <SkeletonBlock className="h-9 w-40 rounded-md" />
        <SkeletonBlock className="h-9 w-24 rounded-md" />
      </div>

      {/* Liste */}
      <Card className="p-2" aria-busy aria-live="polite">
        <CardHeader className="space-y-2">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-3 w-32" />
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <li
                key={i}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3"
              >
                <div className="min-w-0 space-y-2">
                  <SkeletonBlock className="h-4 w-48" />
                  <SkeletonBlock className="h-3 w-24" />
                </div>
                <SkeletonBlock className="hidden h-3 w-12 sm:block" />
                <SkeletonBlock className="h-4 w-10" />
                <SkeletonBlock className="h-5 w-16 rounded-full" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
