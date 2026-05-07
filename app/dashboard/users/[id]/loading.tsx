import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonBlock } from "@/components/dashboard/skeleton-card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10" aria-busy aria-live="polite">
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        <SkeletonBlock className="size-14 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="h-4 w-64" />
        </div>
      </header>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-2">
            <CardHeader className="space-y-3">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-8 w-20" />
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* Chart */}
      <section className="mt-8">
        <Card className="p-2">
          <CardHeader className="space-y-2">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="h-3 w-72" />
          </CardHeader>
          <CardContent>
            <SkeletonBlock className="h-[250px] w-full" />
          </CardContent>
        </Card>
      </section>

      {/* Recent calls */}
      <section className="mt-8">
        <Card className="p-2">
          <CardHeader className="space-y-2">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-3 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
