// ============================================================================
// ConversationDynamics — affichage des métriques conversationnelles (J20)
// ============================================================================
// Présentation pure (Server Component) des métriques déterministes calculées
// par lib/metrics/conversation.ts : talk ratio, ping-pong, monologue, jump to
// pitch. Le but produit = un « radar à problèmes » lisible en 3 secondes par
// un manager, avec des alertes actionnables plutôt qu'un mur de chiffres.
// ============================================================================

import { AlertTriangle, Mic, Repeat, Timer, Zap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConversationMetrics } from "@/lib/metrics/conversation";

// "1:05" — minutes:secondes à partir de millisecondes.
function msToClock(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 0.72 → "72 %". null → "–".
function ratioToPct(ratio: number | null): string {
  if (ratio === null) return "–";
  return `${Math.round(ratio * 100)} %`;
}

// Une tuile de métrique : icône + libellé + valeur + indice pédagogique court.
// `warn` colore la valeur en orange quand un seuil d'alerte est franchi.
function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
  warn = false,
}: {
  icon: typeof Mic;
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {label}
        </div>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums tracking-tight",
            warn ? "text-orange-600 dark:text-orange-400" : "text-foreground",
          )}
        >
          {value}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function ConversationDynamics({
  metrics,
}: {
  metrics: ConversationMetrics;
}) {
  const {
    talk_ratio,
    prospect_talk_ratio,
    turns,
    avg_turn_ms,
    longest_monologue_ms,
    jump_to_pitch_ms,
    flags,
  } = metrics;

  // Largeurs de la barre talk ratio (commercial vs prospect). Repli 50/50 si
  // pas de donnée exploitable (appel sans parole détectée).
  const commercialPct =
    talk_ratio !== null ? Math.round(talk_ratio * 100) : 50;
  const prospectPct = 100 - commercialPct;

  // Alertes actionnables dérivées des drapeaux — le cœur du « radar à problèmes ».
  const alerts: string[] = [];
  if (flags.talk_ratio_high) {
    alerts.push(
      `Le commercial monopolise la parole (${ratioToPct(talk_ratio)}). Au-delà de 65 %, on « pitche » au lieu d'écouter — poser plus de questions ouvertes.`,
    );
  }
  if (flags.prospect_silent) {
    alerts.push(
      `Le prospect parle peu (${ratioToPct(prospect_talk_ratio)}). Un prospect quasi muet est souvent un prospect désengagé — le faire réagir.`,
    );
  }
  if (flags.pitch_too_early && jump_to_pitch_ms !== null) {
    alerts.push(
      `La solution est présentée très tôt (${msToClock(jump_to_pitch_ms)}). La phase de découverte a probablement été écourtée.`,
    );
  }

  return (
    <div className="grid gap-4">
      {/* Barre talk ratio commercial vs prospect */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              Temps de parole
            </span>
            <span className="text-xs text-muted-foreground">
              Commercial {ratioToPct(talk_ratio)} · Prospect{" "}
              {ratioToPct(prospect_talk_ratio)}
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full",
                flags.talk_ratio_high ? "bg-orange-500" : "bg-mint",
              )}
              style={{ width: `${commercialPct}%` }}
              aria-label={`Commercial ${commercialPct} %`}
            />
            <div
              className="h-full bg-foreground/20"
              style={{ width: `${prospectPct}%` }}
              aria-label={`Prospect ${prospectPct} %`}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Commercial</span>
            <span>Prospect</span>
          </div>
        </CardContent>
      </Card>

      {/* Tuiles de métriques */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTile
          icon={Mic}
          label="Parole commercial"
          value={ratioToPct(talk_ratio)}
          hint="Idéalement sous 65 % : vendre, c'est écouter."
          warn={flags.talk_ratio_high}
        />
        <MetricTile
          icon={Repeat}
          label="Tours de parole"
          value={turns > 0 ? `${turns}` : "–"}
          hint={
            turns > 0
              ? `Échange moyen de ${msToClock(avg_turn_ms)}. Beaucoup de tours courts = vraie conversation.`
              : "Aucun échange détecté."
          }
        />
        <MetricTile
          icon={Timer}
          label="Plus long monologue"
          value={longest_monologue_ms > 0 ? msToClock(longest_monologue_ms) : "–"}
          hint="Plus longue tirade ininterrompue du commercial."
        />
        <MetricTile
          icon={Zap}
          label="Passage au pitch"
          value={jump_to_pitch_ms !== null ? msToClock(jump_to_pitch_ms) : "non détecté"}
          hint="Moment où le commercial présente la solution. Trop tôt = découverte bâclée."
          warn={flags.pitch_too_early}
        />
        <MetricTile
          icon={Mic}
          label="Parole prospect"
          value={ratioToPct(prospect_talk_ratio)}
          hint="Un prospect qui parle est un prospect engagé."
          warn={flags.prospect_silent}
        />
      </div>

      {/* Alertes actionnables (le radar à problèmes) */}
      {alerts.length > 0 ? (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
              <AlertTriangle className="size-4" aria-hidden />
              Signaux à surveiller
            </p>
            <ul className="space-y-1.5">
              {alerts.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground">
                  <span className="select-none text-orange-500">•</span>
                  <span className="leading-relaxed">{a}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
