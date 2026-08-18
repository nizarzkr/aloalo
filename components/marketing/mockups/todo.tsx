// ============================================================================
// Réplique — file « À faire » (/dashboard/todo)
// ============================================================================
// Même structure que `components/dashboard/todo-list.tsx` : groupes par
// échéance, une case à cocher, le contact et la raison de la tâche.
// Le message porté par cet écran : ces tâches, personne ne les a saisies.
// ============================================================================

import { CalendarClock, CheckCircle2, Circle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { Frame } from "./frame";

type Task = {
  title: string;
  contact: string;
  reason: string;
  due: string;
  done?: boolean;
};

const GROUPS: { label: string; accent?: boolean; tasks: Task[] }[] = [
  {
    label: "En retard",
    accent: true,
    tasks: [
      {
        title: "Envoyer l'étude de cas secteur industrie",
        contact: "Thomas Vidal — Acme Corp",
        reason: "demandée pendant l'appel",
        due: "hier",
      },
    ],
  },
  {
    label: "Aujourd'hui",
    tasks: [
      {
        title: "Recaler une date de démo technique",
        contact: "Camille Roux — Acme Corp",
        reason: "aucune date fixée en fin d'appel",
        due: "aujourd'hui",
      },
      {
        title: "Transmettre la grille tarifaire à la DAF",
        contact: "Camille Roux — Acme Corp",
        reason: "décision partagée avec la finance",
        due: "aujourd'hui",
        done: true,
      },
    ],
  },
  {
    label: "Cette semaine",
    tasks: [
      {
        title: "Relancer sur le périmètre du pilote",
        contact: "Sarah Benali — Lumen Studio",
        reason: "sans nouvelle depuis 12 jours",
        due: "jeu. 24",
      },
    ],
  },
];

export function TodoMockup({ className }: { className?: string }) {
  return (
    <Frame
      label="aloalo.app / à faire"
      activeItem="À faire"
      className={className}
    >
      <div className="space-y-3">
        <p className="font-heading text-base font-medium">À faire</p>

        {GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p
              className={cn(
                "font-mono text-[10px] tracking-[-0.03em] uppercase",
                group.accent ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {group.label}
            </p>
            <Card size="sm" className="py-0">
              <ul className="divide-y divide-foreground/5">
                {group.tasks.map((task) => (
                  <li key={task.title} className="flex items-start gap-2.5 p-3">
                    {task.done ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-foreground" />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13px] font-medium",
                          task.done && "text-muted-foreground line-through",
                        )}
                      >
                        {task.title}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {task.contact} · {task.reason}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                      <CalendarClock className="size-3" />
                      {task.due}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>
    </Frame>
  );
}
