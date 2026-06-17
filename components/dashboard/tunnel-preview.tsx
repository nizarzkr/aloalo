// ============================================================================
// components/dashboard/tunnel-preview.tsx — Aperçu de la carte du tunnel HubSpot
// ============================================================================
// Composant présentationnel pur (server-safe) : affiche les pipelines de deals
// et leurs phases ORDONNÉES (chip par phase, n° d'ordre en mono, phase fermée en
// menthe, tooltip probabilité), + la date de dernière synchro. Extrait de la page
// Intégrations (J27) pour être réutilisé tel quel dans l'onboarding (J29) sans
// dupliquer le markup. Aucun changement de comportement.
// ============================================================================

import { cn } from "@/lib/utils";
import type { HubspotPipeline } from "@/lib/hubspot";

type Props = {
  pipelines: HubspotPipeline[];
  syncedAt: string | null;
};

export function TunnelPreview({ pipelines, syncedAt }: Props) {
  if (pipelines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Tunnel pas encore synchronisé.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {pipelines.map((p) => (
        <div
          key={p.id}
          className="rounded-md border border-border bg-muted/30 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{p.label}</p>
            <code className="font-mono text-[10px] text-muted-foreground">
              {p.id}
            </code>
          </div>
          <ol className="flex flex-wrap items-center gap-1.5">
            {p.stages.map((s, i) => (
              <li key={s.id}>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs",
                    s.isClosed
                      ? "bg-mint text-foreground"
                      : "border border-border bg-background text-foreground",
                  )}
                  title={
                    s.probability != null
                      ? `Probabilité : ${Math.round(s.probability * 100)}%`
                      : undefined
                  }
                >
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {syncedAt ? (
        <p className="text-[11px] text-muted-foreground">
          Dernière synchronisation :{" "}
          {new Date(syncedAt).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      ) : null}
    </div>
  );
}
