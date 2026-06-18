// ============================================================================
// SalesHome — accueil personnel d'un commercial (J34, axe « Travailler »)
// ============================================================================
// Vue bienveillante et centrée sur SON travail (pas d'org-level, pas de cadran
// « risque » sur la personne) : ses prochaines étapes (issues des suggested_tasks
// déjà produites par l'IA) + ses appels déjà analysés. Lecture seule, aucune IA.
// Composant serveur présentationnel : les données sont fetchées dans page.tsx.
// ============================================================================

import Link from "next/link";
import { CalendarClock, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CallStatusBadge } from "@/components/dashboard/call-status-badge";
import { DimensionsDots } from "@/components/dashboard/dimensions-dots";
import { ListAutoRefresh } from "@/components/dashboard/list-auto-refresh";
import { revalidateDashboardHome } from "@/app/dashboard/calls/actions";

export type SalesNextTask = {
  title: string;
  dueDate: string | null; // AAAA-MM-JJ
  callId: string;
  contactLabel: string;
};

export type SalesCall = {
  id: string;
  contactLabel: string;
  subtitle: string | null; // entreprise · deal
  dateRef: string;
  durationSeconds: number | null;
  status: string;
  dimensions: unknown;
};

type Props = {
  firstName: string;
  nextTasks: SalesNextTask[];
  calls: SalesCall[];
  liveSignature: string;
  liveActive: boolean;
};

function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return "–";
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}min` : `${h}h ${m}min`;
}

// Échéance d'une tâche en clair (ex. « 22 juin »), tolère une date absente.
function formatDueDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function SalesHome({
  firstName,
  nextTasks,
  calls,
  liveSignature,
  liveActive,
}: Props) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {firstName ? `Bonjour, ${firstName}` : "Bonjour"}
        </h1>
      </header>

      {/* Rafraîchit les badges tant qu'un de tes appels est en cours. */}
      <ListAutoRefresh
        signature={liveSignature}
        active={liveActive}
        onRevalidate={revalidateDashboardHome}
      />

      {/* --- Tes prochaines étapes (issues de l'analyse, zéro saisie) -------- */}
      {nextTasks.length > 0 ? (
        <section className="mb-10">
          <Card className="p-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-foreground" aria-hidden />
                Tes prochaines étapes
              </CardTitle>
              <CardDescription>
                Suggérées à partir de tes appels — à toi de jouer.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border">
                {nextTasks.map((task, i) => {
                  const due = formatDueDate(task.dueDate);
                  return (
                    <li key={`${task.callId}-${i}`}>
                      <Link
                        href={`/dashboard/calls/${task.callId}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {task.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {task.contactLabel}
                          </p>
                        </div>
                        {due ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                            <CalendarClock className="size-3" aria-hidden />
                            {due}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* --- Tes appels, déjà analysés ------------------------------------- */}
      <section>
        {calls.length === 0 ? (
          <Card className="p-2">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                Tes appels apparaîtront ici, déjà analysés — sans aucune note à
                prendre de ton côté.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-2">
            <CardHeader>
              <CardTitle>Tes appels</CardTitle>
              <CardDescription>
                Déjà transcrits et analysés — zéro note à prendre.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border">
                {calls.map((call) => (
                  <li key={call.id}>
                    <Link
                      href={`/dashboard/calls/${call.id}`}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {call.contactLabel}
                        </p>
                        {call.subtitle ? (
                          <p className="truncate text-xs font-medium text-muted-foreground">
                            {call.subtitle}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {new Date(call.dateRef).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
                        {formatDuration(call.durationSeconds)}
                      </span>
                      <span className="justify-self-end">
                        <DimensionsDots dimensions={call.dimensions} />
                      </span>
                      <CallStatusBadge status={call.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
