// ============================================================================
// DimensionsEval — scoring FACTUEL par dimensions (J21)
// ============================================================================
// Remplace le score /100. Pour chacune des 5 dimensions de l'appel : un statut
// vérifiable (validé / partiel / manqué), la checklist des critères remplis ou
// non, et une CITATION exacte qui le justifie. C'est la preuve, pas le chiffre.
//
// Les métadonnées (libellés, ordre, couleurs de statut) sont exportées et
// réutilisées par la barre de synthèse (chips de dimensions).
// ============================================================================

import { Check, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  DimensionEval,
  DimensionKey,
  DimensionStatus,
} from "@/lib/claude";

export const DIMENSION_META: Record<
  DimensionKey,
  { label: string; short: string; hint: string }
> = {
  discovery: {
    label: "Découverte",
    short: "Découverte",
    hint: "Questions ouvertes, contexte, pain quantifié",
  },
  qualification: {
    label: "Qualification (BANT)",
    short: "Qualif.",
    hint: "Budget, autorité, besoin, timeline",
  },
  objection_handling: {
    label: "Traitement des objections",
    short: "Objections",
    hint: "Accueil, reformulation, réponse argumentée",
  },
  closing: {
    label: "Closing",
    short: "Closing",
    hint: "Pousser vers une décision concrète",
  },
  next_step: {
    label: "Next step",
    short: "Next step",
    hint: "Prochaine étape datée et engageante",
  },
};

export const DIMENSION_ORDER: DimensionKey[] = [
  "discovery",
  "qualification",
  "objection_handling",
  "closing",
  "next_step",
];

// Couleurs et libellé par statut — partagées avec la barre de synthèse.
export const STATUS_META: Record<
  DimensionStatus,
  { label: string; dot: string; pill: string }
> = {
  validé: {
    label: "Validé",
    dot: "bg-green-500",
    pill: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
  },
  partiel: {
    label: "Partiel",
    dot: "bg-orange-500",
    pill: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  manqué: {
    label: "Manqué",
    dot: "bg-red-500",
    pill: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

// Normalise un statut potentiellement inattendu (vieille donnée / sortie IA) en
// repli 'partiel' pour ne jamais casser le rendu.
function safeStatus(status: unknown): DimensionStatus {
  return status === "validé" || status === "partiel" || status === "manqué"
    ? status
    : "partiel";
}

export function DimensionsEval({ dimensions }: { dimensions: DimensionEval[] }) {
  // Réordonne selon DIMENSION_ORDER (l'IA est censée respecter l'ordre, mais on
  // ne s'y fie pas pour l'affichage). On ignore une clé inconnue.
  const byKey = new Map(dimensions.map((d) => [d.key, d]));
  const ordered = DIMENSION_ORDER.map((key) => byKey.get(key)).filter(
    (d): d is DimensionEval => Boolean(d),
  );

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Évaluation par dimensions indisponible pour cet appel.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {ordered.map((dim) => {
        const meta = DIMENSION_META[dim.key];
        const status = safeStatus(dim.status);
        const statusMeta = STATUS_META[status];
        const criteria = Array.isArray(dim.criteria) ? dim.criteria : [];

        return (
          <Card key={dim.key}>
            <CardContent className="space-y-3">
              {/* En-tête : dimension + statut */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.hint}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    statusMeta.pill,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", statusMeta.dot)} />
                  {statusMeta.label}
                </span>
              </div>

              {/* Checklist des critères */}
              {criteria.length > 0 ? (
                <ul className="space-y-1.5">
                  {criteria.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {c.met ? (
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400"
                          aria-hidden
                        />
                      ) : (
                        <X
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground/60"
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "leading-relaxed",
                          c.met
                            ? "text-foreground"
                            : "text-muted-foreground line-through decoration-muted-foreground/40",
                        )}
                      >
                        {c.label}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Citation qui prouve le statut */}
              {dim.evidence ? (
                <p className="border-l-2 border-border pl-3 text-xs italic leading-relaxed text-muted-foreground">
                  « {dim.evidence} »
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
