"use client";

// ============================================================================
// TodoList — file « À faire » cochable (J37, axe Travailler)
// ============================================================================
// Tâches groupées par urgence, complétion optimiste (server action en fond).
// Touche motivante DOSÉE : compteur « bouclées cette semaine » + empty state
// « tout est à jour ». « En retard » en jaune (jamais rouge — c'est une tâche,
// pas un échec).
// ============================================================================

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Circle, Flame } from "lucide-react";

import { toggleTodoAction } from "@/app/dashboard/todo/actions";
import { Card, CardContent } from "@/components/ui/card";
import type { TodoBucket, TodoTask } from "@/lib/tasks/todo";
import { cn } from "@/lib/utils";

const BUCKET_META: { id: TodoBucket; label: string; accent?: boolean }[] = [
  { id: "overdue", label: "En retard", accent: true },
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "Cette semaine" },
  { id: "later", label: "Plus tard" },
  { id: "nodate", label: "Sans échéance" },
];

function keyOf(t: TodoTask) {
  return `${t.callId}::${t.taskKey}`;
}

function formatDue(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function TodoList({
  tasks,
  weeklyDoneCount,
}: {
  tasks: TodoTask[];
  weeklyDoneCount: number;
}) {
  const [items, setItems] = useState<TodoTask[]>(tasks);
  const [, startTransition] = useTransition();

  const active = items.filter((t) => !t.done);
  const done = items.filter((t) => t.done);

  // Regroupe les tâches actives par bucket d'urgence.
  const byBucket = useMemo(() => {
    const map = new Map<TodoBucket, TodoTask[]>();
    for (const t of active) {
      const list = map.get(t.bucket) ?? [];
      list.push(t);
      map.set(t.bucket, list);
    }
    return map;
  }, [active]);

  function toggle(task: TodoTask, nextDone: boolean) {
    // Optimiste : on bascule localement tout de suite.
    setItems((prev) =>
      prev.map((t) => (keyOf(t) === keyOf(task) ? { ...t, done: nextDone } : t)),
    );
    startTransition(async () => {
      const res = await toggleTodoAction(task.callId, task.title, nextDone);
      if (!res.ok) {
        // Rollback en cas d'échec.
        setItems((prev) =>
          prev.map((t) =>
            keyOf(t) === keyOf(task) ? { ...t, done: !nextDone } : t,
          ),
        );
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Tout est à jour 🎉 — rien en attente pour l&apos;instant.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {weeklyDoneCount > 0 ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Flame className="size-4 text-foreground" aria-hidden />
          {weeklyDoneCount} relance{weeklyDoneCount > 1 ? "s" : ""} bouclée
          {weeklyDoneCount > 1 ? "s" : ""} cette semaine
        </p>
      ) : null}

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Plus rien en attente 🎉 Beau travail.
          </CardContent>
        </Card>
      ) : (
        BUCKET_META.map(({ id, label, accent }) => {
          const list = byBucket.get(id);
          if (!list || list.length === 0) return null;
          return (
            <section key={id}>
              <h2
                className={cn(
                  "mb-2 text-xs font-semibold uppercase tracking-wider",
                  accent ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                {label}
                {accent ? (
                  <span className="ml-2 rounded-full bg-yellow/40 px-2 py-0.5 text-[10px] font-medium normal-case text-foreground">
                    {list.length}
                  </span>
                ) : null}
              </h2>
              <Card className="p-2">
                <ul className="divide-y divide-border">
                  {list.map((t) => (
                    <TodoRow key={keyOf(t)} task={t} onToggle={toggle} />
                  ))}
                </ul>
              </Card>
            </section>
          );
        })
      )}

      {/* Section « Fait » */}
      {done.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Fait ({done.length})
          </summary>
          <Card className="mt-2 p-2">
            <ul className="divide-y divide-border">
              {done.map((t) => (
                <TodoRow key={keyOf(t)} task={t} onToggle={toggle} />
              ))}
            </ul>
          </Card>
        </details>
      ) : null}
    </div>
  );
}

function TodoRow({
  task,
  onToggle,
}: {
  task: TodoTask;
  onToggle: (task: TodoTask, nextDone: boolean) => void;
}) {
  const due = formatDue(task.dueDate);
  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <button
        type="button"
        onClick={() => onToggle(task, !task.done)}
        aria-label={task.done ? "Marquer à faire" : "Marquer comme fait"}
        aria-pressed={task.done}
        className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        {task.done ? (
          <CheckCircle2 className="size-5 text-foreground" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <Link
            href={`/dashboard/calls/${task.callId}`}
            className="underline-offset-4 hover:underline"
          >
            {task.contactLabel}
          </Link>
          {task.reason ? ` · ${task.reason}` : ""}
        </p>
      </div>

      {due ? (
        <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <CalendarClock className="size-3" aria-hidden />
          {due}
        </span>
      ) : null}
    </li>
  );
}
