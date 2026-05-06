import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  SkeletonBlock,
  SkeletonCard,
} from "@/components/dashboard/skeleton-card";

// Skeleton d'attente pour /dashboard. Reprend le layout exact de page.tsx :
// titre, 3 KPI cards, liste des 5 derniers appels.
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      {/* Titre "Bienvenue, …" */}
      <header className="mb-8">
        <SkeletonBlock className="h-7 w-56" />
      </header>

      {/* 3 KPI cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-2" aria-busy>
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="h-8 w-20" />
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* Liste des derniers appels */}
      <section className="mt-10">
        <Card className="p-2" aria-busy aria-live="polite">
          <CardHeader className="space-y-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-3 w-56" />
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3"
                >
                  <div className="min-w-0 space-y-2">
                    <SkeletonBlock className="h-4 w-40" />
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
      </section>
    </div>
  );
}
