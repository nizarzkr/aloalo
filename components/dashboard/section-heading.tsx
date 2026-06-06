// ============================================================================
// SectionHeading — en-tête de sous-page de réglages (icône + titre + sous-titre).
// ============================================================================
// Composant présentationnel partagé par toutes les sous-pages de
// /dashboard/settings/* pour un en-tête cohérent. Server-safe (pas de "use client").
// ============================================================================

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  // Action optionnelle alignée à droite du titre (ex. bouton « Rafraîchir »).
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <Icon className="size-5 text-muted-foreground" />
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
