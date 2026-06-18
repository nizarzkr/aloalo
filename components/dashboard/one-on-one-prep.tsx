"use client";

// ============================================================================
// OneOnOnePrep — préparation interactive d'un 1:1 (J35, axe Coacher)
// ============================================================================
// Sélecteur de commercial + de période → bouton « Préparer le brief » (server
// action) → briefing BIENVEILLANT (ce qui progresse → un seul axe → deals →
// continuité) + notes du manager + historique. Le ton positif est porté par
// l'IA (lib/claude.synthesizeOneOnOne) ; ici on met juste en forme.
//
// Remontage par `key={selectedRep}` côté page → l'état interne se réinitialise
// proprement quand on change de commercial.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  Lightbulb,
  Sparkles,
  TrendingUp,
  History,
} from "lucide-react";

import {
  generateOneOnOneAction,
  saveOneOnOneNotesAction,
} from "@/app/dashboard/one-on-ones/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CoachingSession, PeriodType } from "@/lib/coaching/one-on-one";
import { cn } from "@/lib/utils";

export type Member = { id: string; name: string; role: string };
type PeriodOption = { id: PeriodType; label: string; intent: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Manager",
  sales: "Commercial·e",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function OneOnOnePrep({
  members,
  periods,
  selectedRep,
  selectedPeriod,
  sessions,
}: {
  members: Member[];
  periods: PeriodOption[];
  selectedRep: string | null;
  selectedPeriod: PeriodType;
  sessions: CoachingSession[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [period, setPeriod] = useState<PeriodType>(selectedPeriod);
  // Session affichée : la plus récente chargée, ou celle qu'on vient de générer.
  const [current, setCurrent] = useState<CoachingSession | null>(
    sessions[0] ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const rep = members.find((m) => m.id === selectedRep) ?? null;
  const periodMeta = periods.find((p) => p.id === period) ?? periods[0];

  // Changer de commercial → recharge la page (le serveur charge son historique).
  function onRepChange(repId: string | null) {
    if (!repId) return;
    const params = new URLSearchParams();
    params.set("rep", repId);
    params.set("period", period);
    router.push(`/dashboard/one-on-ones?${params.toString()}`);
  }

  function onGenerate() {
    if (!selectedRep) return;
    setError(null);
    startTransition(async () => {
      const res = await generateOneOnOneAction(selectedRep, period);
      if (res.ok && res.data) {
        setCurrent(res.data);
        router.refresh(); // met à jour l'historique côté serveur
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  // Historique = sessions chargées, en excluant celle affichée.
  const history = sessions.filter((s) => s.id !== current?.id);

  return (
    <div className="space-y-6">
      {/* --- Sélecteurs --------------------------------------------------- */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Commercial
            </label>
            <Select value={selectedRep ?? ""} onValueChange={onRepChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un commercial…" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Période
            </label>
            <Select
              value={period}
              onValueChange={(v) => v && setPeriod(v as PeriodType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={onGenerate}
            disabled={!selectedRep || isPending}
            className="shrink-0"
          >
            <Sparkles className="size-4" />
            {isPending ? "Préparation…" : "Préparer le brief"}
          </Button>
        </CardContent>
      </Card>

      {/* Intention de la période choisie — guide le manager sans imposer. */}
      {rep ? (
        <p className="px-1 text-xs text-muted-foreground">
          {periodMeta.label} · {periodMeta.intent}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* --- États ------------------------------------------------------- */}
      {!rep ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Choisissez un commercial pour préparer votre prochain 1:1.
          </CardContent>
        </Card>
      ) : !current ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun brief encore généré pour {rep.name}. Choisissez une période et
            cliquez sur « Préparer le brief ».
          </CardContent>
        </Card>
      ) : (
        <Briefing session={current} repName={rep.name} />
      )}

      {/* --- Historique -------------------------------------------------- */}
      {rep && history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" aria-hidden />
              1:1 précédents
            </CardTitle>
            <CardDescription>
              La progression de {rep.name}, entretien après entretien.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {history.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-6 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.snapshot?.brief?.focus?.axis_label ??
                        "Pas assez de données sur la période"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrent(s)}
                    className="shrink-0 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Revoir
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Briefing — mise en forme bienveillante d'une session (+ notes éditables).
// ----------------------------------------------------------------------------
function Briefing({
  session,
  repName,
}: {
  session: CoachingSession;
  repName: string;
}) {
  const snap = session.snapshot;
  const [notes, setNotes] = useState(session.manager_notes ?? "");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  function onSaveNotes() {
    setSavedMsg(null);
    startSave(async () => {
      const res = await saveOneOnOneNotesAction(session.id, notes);
      setSavedMsg(res.ok ? "Notes enregistrées." : res.error);
    });
  }

  // Cas « pas assez de données » : message bienveillant, pas de brief IA.
  if (!snap || snap.empty || !snap.brief) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Pas encore assez d&apos;échanges analysés sur cette période pour{" "}
          {repName}. Reviens après quelques appels — la vue sera plus riche.
        </CardContent>
      </Card>
    );
  }

  const brief = snap.brief;
  const trend =
    snap.avgValidated != null && snap.prevAvgValidated != null
      ? snap.avgValidated - snap.prevAvgValidated
      : null;

  return (
    <div className="space-y-4">
      {/* Bandeau synthèse + tendance (le progrès prime sur le niveau). */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {snap.callCount} appel{snap.callCount > 1 ? "s" : ""}
            </span>{" "}
            analysé{snap.callCount > 1 ? "s" : ""} sur la période
          </div>
          {snap.avgValidated != null ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Dimensions validées</span>
              <span className="font-semibold tabular-nums">
                {snap.avgValidated.toLocaleString("fr-FR")} / 5
              </span>
              {trend != null && trend !== 0 ? (
                <Badge
                  className={cn(
                    "gap-1",
                    trend > 0
                      ? "bg-mint text-foreground"
                      : "bg-yellow/40 text-foreground",
                  )}
                >
                  <TrendingUp
                    className={cn("size-3", trend < 0 && "rotate-180")}
                    aria-hidden
                  />
                  {trend > 0 ? "+" : ""}
                  {trend.toLocaleString("fr-FR")}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 🎉 Ce qui progresse */}
      {brief.wins.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎉 Ce qui progresse</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {brief.wins.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-mint" />
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* 🌱 À travailler ensemble (un seul axe) */}
      <Card className="border-mint/60">
        <CardHeader>
          <CardTitle className="text-base">
            🌱 À travailler ensemble
          </CardTitle>
          <CardDescription>{brief.focus.axis_label}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {brief.focus.why ? <p>{brief.focus.why}</p> : null}
          {brief.focus.suggestion ? (
            <div className="flex gap-2 rounded-md bg-muted/50 p-3">
              <Lightbulb className="size-4 shrink-0 text-foreground" aria-hidden />
              <p>
                <span className="font-medium">Piste à tester : </span>
                {brief.focus.suggestion}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 📂 Ses deals à suivre */}
      {snap.deals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📂 Ses deals à suivre</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {snap.deals.map((d) => (
                <li key={d.group_key} className="px-6 py-3">
                  <Link
                    href={`/dashboard/deals/${encodeURIComponent(d.group_key)}`}
                    className="flex items-start justify-between gap-3 hover:underline"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.action}</p>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0",
                        d.severity === "haute"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow/40 text-foreground",
                      )}
                    >
                      {d.severity === "haute" ? "À prioriser" : "À surveiller"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* 🔄 Depuis le dernier 1:1 */}
      {snap.sinceLast ? (
        <Card>
          <CardContent className="flex items-start gap-2 pt-6 text-sm">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>
              <span className="font-medium">
                Depuis votre dernier 1:1 ({formatDate(snap.sinceLast.date)})
              </span>{" "}
              — l&apos;axe travaillé était «&nbsp;{snap.sinceLast.focusAxis}
              &nbsp;».
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Encouragement de clôture */}
      {brief.encouragement ? (
        <p className="px-1 text-sm italic text-muted-foreground">
          {brief.encouragement}
        </p>
      ) : null}

      {/* Notes du manager */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vos notes</CardTitle>
          <CardDescription>
            Ce que vous voulez aborder ou retenir de l&apos;entretien.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Points à aborder, décisions prises, engagements…"
            rows={4}
            maxLength={4000}
          />
          <div className="flex items-center gap-3">
            <Button onClick={onSaveNotes} disabled={isSaving} variant="outline">
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {savedMsg ? (
              <span className="text-xs text-muted-foreground">{savedMsg}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
