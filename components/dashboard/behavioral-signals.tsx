// ============================================================================
// BehavioralSignals — signaux comportementaux IA (J22)
// ============================================================================
// Le « SENS » de la conversation, en complément des métriques déterministes du
// J20 (le rythme). Deux volets : le comportement du COMMERCIAL (questions,
// réaction au prix, tenue du silence) et l'ENGAGEMENT du PROSPECT (signaux
// d'achat, fermeté du next step, vraie/fausse objection, interruptions).
// Affiché dans l'onglet « Dynamique », sous ConversationDynamics.
// ============================================================================

import type { ReactNode } from "react";
import { Headset, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  BehavioralSignals as BehavioralSignalsData,
  NextStepFirmness,
  ObjectionNature,
  PriceReaction,
  SilenceAfterObjection,
} from "@/lib/claude";

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
  warn: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  bad: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

// Ligne « libellé à gauche · valeur à droite ».
function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

const PRICE_REACTION_META: Record<PriceReaction, { tone: Tone; label: string }> = {
  creusage: { tone: "good", label: "Creusage" },
  esquive: { tone: "warn", label: "Esquive" },
  panique: { tone: "bad", label: "Panique (remise)" },
  non_applicable: { tone: "neutral", label: "Pas d'objection prix" },
};

const SILENCE_META: Record<SilenceAfterObjection, { tone: Tone; label: string }> = {
  encaisse: { tone: "good", label: "Encaisse" },
  comble: { tone: "warn", label: "Comble le vide" },
  non_applicable: { tone: "neutral", label: "—" },
};

const FIRMNESS_META: Record<NextStepFirmness, { tone: Tone; label: string }> = {
  ferme: { tone: "good", label: "Ferme" },
  mou: { tone: "warn", label: "Mou" },
  absent: { tone: "bad", label: "Absent" },
};

const OBJECTION_META: Record<ObjectionNature, { tone: Tone; label: string }> = {
  vraie: { tone: "good", label: "Vraie (engagement)" },
  fausse: { tone: "warn", label: "Fausse (désengagement)" },
  aucune: { tone: "neutral", label: "Aucune" },
};

export function BehavioralSignals({
  signals,
}: {
  signals: BehavioralSignalsData;
}) {
  const buyingSignals = Array.isArray(signals.buying_signals)
    ? signals.buying_signals
    : [];
  const totalQuestions =
    (signals.open_questions ?? 0) + (signals.closed_questions ?? 0);
  const interruptions = signals.constructive_interruptions ?? 0;

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Signaux comportementaux
        </h3>
        <p className="text-xs text-muted-foreground">
          Lus par l&apos;IA dans la conversation — l&apos;intention derrière les
          mots.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Côté commercial */}
        <Card>
          <CardContent className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Headset className="size-4 text-muted-foreground" aria-hidden />
              Côté commercial
            </p>

            <Row label="Questions ouvertes / fermées">
              {totalQuestions > 0 ? (
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {signals.open_questions ?? 0}{" "}
                  <span className="text-muted-foreground">ouv.</span> ·{" "}
                  {signals.closed_questions ?? 0}{" "}
                  <span className="text-muted-foreground">ferm.</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </Row>

            <Row label="Réaction au prix">
              <Pill tone={PRICE_REACTION_META[signals.price_reaction].tone}>
                {PRICE_REACTION_META[signals.price_reaction].label}
              </Pill>
            </Row>

            <Row label="Silence après objection">
              <Pill tone={SILENCE_META[signals.silence_after_objection].tone}>
                {SILENCE_META[signals.silence_after_objection].label}
              </Pill>
            </Row>
          </CardContent>
        </Card>

        {/* Côté prospect (engagement) */}
        <Card>
          <CardContent className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="size-4 text-muted-foreground" aria-hidden />
              Côté prospect (engagement)
            </p>

            <Row label="Fermeté du next step">
              <Pill tone={FIRMNESS_META[signals.next_step_firmness].tone}>
                {FIRMNESS_META[signals.next_step_firmness].label}
              </Pill>
            </Row>

            <Row label="Nature de l'objection">
              <Pill tone={OBJECTION_META[signals.objection_nature].tone}>
                {OBJECTION_META[signals.objection_nature].label}
              </Pill>
            </Row>
            {signals.objection_quote ? (
              <p className="border-l-2 border-border pl-3 text-xs italic leading-relaxed text-muted-foreground">
                « {signals.objection_quote} »
              </p>
            ) : null}

            <Row label="Interruptions constructives">
              <Pill tone={interruptions > 0 ? "good" : "neutral"}>
                {interruptions}
              </Pill>
            </Row>
          </CardContent>
        </Card>
      </div>

      {/* Signaux d'achat captés (citations) */}
      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Signaux d&apos;achat captés
          </p>
          {buyingSignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun signal d&apos;achat détecté sur cet appel.
            </p>
          ) : (
            <ul className="space-y-3">
              {buyingSignals.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-green-500"
                  />
                  <div>
                    <p className="font-medium text-foreground">{s.label}</p>
                    {s.quote ? (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">
                        « {s.quote} »
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
