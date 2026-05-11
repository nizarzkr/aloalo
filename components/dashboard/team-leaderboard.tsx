// ============================================================================
// TeamLeaderboard — Classement 7j + alertes "en chute" (J11)
// ============================================================================
// Server Component pur : reçoit les entries déjà calculées côté page.tsx, ne
// fait aucune requête. Sert juste à l'affichage : rang, initiales, score moyen
// 7j, nombre d'appels analysés, badge orange si delta < -10 vs. les 7 jours
// précédents.
// ============================================================================

import Link from "next/link";
import { TrendingDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type LeaderboardEntry = {
  profileId: string;
  fullName: string | null;
  email: string;
  scoreRecent: number | null; // arrondi à l'entier, null si aucun appel sur 7j
  callsCountRecent: number;
  isDropping: boolean; // delta vs. semaine précédente < -10 pts
};

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return letters || "?";
}

function formatScore(score: number | null) {
  return score === null ? "–" : `${score}/100`;
}

function pluralize(n: number, singular: string, plural: string) {
  return n > 1 ? plural : singular;
}

export function TeamLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-8">
      <Card className="p-2">
        <CardHeader>
          <CardTitle>Classement — 7 derniers jours</CardTitle>
          <CardDescription>
            Score moyen par commercial·e sur la semaine écoulée. Une alerte
            «&nbsp;en chute&nbsp;» s&apos;affiche si la baisse dépasse 10
            points par rapport à la semaine précédente.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y divide-border">
            {entries.map((e, idx) => {
              const displayName = e.fullName?.trim() || e.email;
              const callsLabel = `${e.callsCountRecent} ${pluralize(
                e.callsCountRecent,
                "appel analysé",
                "appels analysés",
              )}`;

              return (
                <li
                  key={e.profileId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
                    >
                      {initials(e.fullName, e.email)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/users/${e.profileId}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {displayName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {callsLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {e.isDropping ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 border-0 bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                      >
                        <TrendingDown className="size-3" />
                        En chute
                      </Badge>
                    ) : null}
                    <span className="text-sm font-semibold tabular-nums">
                      {formatScore(e.scoreRecent)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
