// ============================================================================
// lib/ringover.ts — Wrapper minimal sur l'API REST Ringover.
// ============================================================================
// Contexte (décision archi 2026-05-13) : pas de compte Ringover Developers
// central. Chaque client connecte son propre compte Ringover en collant sa
// clé API dans /dashboard/settings ; cette clé sert ici à récupérer l'URL
// audio d'un appel terminé, à partir de l'ID transmis dans le webhook.
//
// Doc Ringover : https://developer.ringover.com/
// Endpoint utilisé : GET /v2/calls/{callId}/recording
// ============================================================================

const RINGOVER_API_BASE = "https://public-api.ringover.com/v2";

/**
 * Récupère l'URL publique du recording d'un appel Ringover.
 *
 * @param callId  — identifiant Ringover de l'appel (provider_call_id côté DB)
 * @param apiKey  — clé API Ringover du client (Bearer token)
 * @returns URL audio (string) si le recording existe et est dispo,
 *          null si pas d'enregistrement ou erreur réseau / API
 *
 * Important : on ne fait JAMAIS apparaître la clé API dans les logs.
 */
export async function getRingoverCallRecording(
  callId: string,
  apiKey: string,
): Promise<string | null> {
  if (!callId || !apiKey) {
    return null;
  }

  try {
    const res = await fetch(
      `${RINGOVER_API_BASE}/calls/${encodeURIComponent(callId)}/recording`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        // Petit garde-fou réseau : on ne veut pas bloquer le webhook
        // indéfiniment si Ringover ne répond pas.
        signal: AbortSignal.timeout(10_000),
      },
    );

    // 404 = pas de recording pour cet appel (cas normal côté Ringover)
    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      // On log le status seulement — surtout pas la clé ni le body, qui
      // pourraient contenir des bouts de credentials.
      console.error("[ringover] recording fetch failed", {
        callId,
        status: res.status,
      });
      return null;
    }

    // Format de réponse Ringover :
    //   { "record_url": "https://...", ... }  (ou champs proches selon version)
    // On accepte plusieurs noms de champ pour rester souple, et on ne casse
    // pas si la forme évolue côté Ringover.
    const data = (await res.json()) as Record<string, unknown>;
    const url =
      (data.record_url as string | undefined) ??
      (data.recording_url as string | undefined) ??
      (data.url as string | undefined) ??
      null;

    if (typeof url === "string" && url.startsWith("http")) {
      return url;
    }

    return null;
  } catch (err) {
    // Réseau down, timeout, JSON cassé… on dégrade silencieusement vers null,
    // le webhook continuera en mode "pas d'audio" et le call passera en failed
    // côté /api/transcribe.
    console.error("[ringover] recording fetch threw", {
      callId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}
