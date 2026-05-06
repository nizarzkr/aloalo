import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Bloc gris animé : utilisé comme brique de base dans tous les skeletons.
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden
    />
  );
}

// Card placeholder réutilisable. `rows` = nombre de lignes de skeleton
// affichées dans le corps de la card (défaut 3).
export function SkeletonCard({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <Card className={cn("p-2", className)} aria-busy aria-live="polite">
      <CardContent className="space-y-3 py-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBlock
            key={i}
            // Dernière ligne plus courte pour casser la régularité.
            className={cn("h-4 w-full", i === rows - 1 && "w-2/3")}
          />
        ))}
      </CardContent>
    </Card>
  );
}
