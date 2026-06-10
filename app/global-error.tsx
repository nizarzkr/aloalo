"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Filet de dernier recours : capture les erreurs du root layout lui-même,
// que les error.tsx imbriqués ne peuvent pas attraper. Doit rendre <html>/<body>.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <p>Une erreur inattendue est survenue.</p>
      </body>
    </html>
  );
}
