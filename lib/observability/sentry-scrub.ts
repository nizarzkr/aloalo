import type { ErrorEvent } from "@sentry/nextjs";

// Défense en profondeur : on ne veut JAMAIS envoyer de contenu d'appel
// (transcription) à Sentry, même si une future modif l'ajoute par erreur à un
// event. On masque toute clé susceptible de porter du contenu d'appel, à tous
// les niveaux où Sentry range des données arbitraires (extra, contexts, tags).
const REDACTED_KEYS = new Set(["transcript", "transcript_text", "segments"]);

const REDACTED = "[redacted]";

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACTED_KEYS.has(k) ? REDACTED : scrub(v);
    }
    return out;
  }
  return value;
}

// beforeSend partagé par les 3 runtimes Sentry (client, server, edge).
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
  if (event.contexts)
    event.contexts = scrub(event.contexts) as typeof event.contexts;
  if (event.tags) event.tags = scrub(event.tags) as typeof event.tags;
  return event;
}
