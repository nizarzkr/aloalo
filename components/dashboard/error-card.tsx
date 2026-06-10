"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Carte d'erreur réutilisable. Reçoit l'erreur et la fonction reset()
// fournies par Next.js à un fichier error.tsx.
export function ErrorCard({
  error,
  reset,
  title = "Une erreur est survenue",
  description = "Le chargement de cette page a échoué. Vous pouvez réessayer ou revenir au dashboard.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    // Log local pour le debug en dev…
    console.error("[dashboard error boundary]", error);
    // …et remontée Sentry pour les crashs de rendu côté client (non couverts
    // par onRequestError, qui ne capture que le serveur). Cf. instrumentation.ts.
    Sentry.captureException(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-xl p-2" role="alert" aria-live="assertive">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          >
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error.message ? (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {error.message}
          </pre>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={reset} size="sm">
            <RotateCcw className="size-4" />
            Réessayer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
