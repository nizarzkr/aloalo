// ============================================================================
// lib/google-meet.ts — Lecture des réunions Meet + transcriptions natives (J42)
// ============================================================================
// SERVER-ONLY. S'appuie sur getGoogleToken (lib/google-oauth.ts) pour un
// access_token valide (rafraîchi auto).
//
// Décision archi (Nizar, 18/06) : on lit la TRANSCRIPTION native de Meet (API
// conferenceRecords.transcripts.entries) plutôt que de télécharger la vidéo et
// de la transcrire via AssemblyAI. Gain : zéro coût de transcription, vrais noms
// de participants, pas de scope Drive.
//
// ⚠️ Prérequis côté Google : compte Workspace payant (Business Standard+) ET
// transcriptions activées pendant la réunion. Sinon l'API renvoie des listes
// vides (pas une erreur).
//
// Doc : https://developers.google.com/meet/api/reference/rest/v2
// Endpoints utilisés :
//   GET /v2/conferenceRecords
//   GET /v2/{conferenceRecord}/transcripts
//   GET /v2/{transcript}/entries
// ============================================================================

import type { TranscriptSegment } from "@/lib/assemblyai";
import { getGoogleToken } from "@/lib/google-oauth";

const BASE_URL = "https://meet.googleapis.com/v2";

// Forme brute (sous-ensemble) renvoyée par l'API Meet.
type ConferenceRecord = {
  name: string; // "conferenceRecords/{id}"
  startTime?: string;
  endTime?: string;
};

type Transcript = {
  name: string; // "conferenceRecords/{id}/transcripts/{tid}"
  state?: "STATE_UNSPECIFIED" | "STARTED" | "ENDED" | "FILE_GENERATED";
  startTime?: string;
  endTime?: string;
};

type TranscriptEntry = {
  name: string;
  participant?: string; // "conferenceRecords/{id}/participants/{pid}"
  text?: string;
  startTime?: string;
  endTime?: string;
  languageCode?: string;
};

// Résumé d'une réunion récente + disponibilité de sa transcription. Sert à
// prouver le livrable J42 (« enregistrements récupérables ») dans l'UI.
export type MeetConferenceSummary = {
  conferenceRecordName: string;
  startTime: string | null;
  endTime: string | null;
  hasTranscript: boolean;
  transcriptName: string | null;
  transcriptReady: boolean; // état FILE_GENERATED / ENDED
};

// GET authentifié sur l'API Meet. Renvoie le JSON typé, ou null en cas d'échec
// (réseau, 4xx/5xx) — on dégrade sans throw côté appelant.
async function meetGet<T>(token: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("[google-meet] GET non-ok", { path, status: res.status });
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("[google-meet] GET threw", {
      path,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

// Liste les enregistrements de conférence récents (les plus récents d'abord).
export async function listConferenceRecords(
  token: string,
  pageSize = 20,
): Promise<ConferenceRecord[]> {
  const data = await meetGet<{ conferenceRecords?: ConferenceRecord[] }>(
    token,
    `conferenceRecords?pageSize=${pageSize}`,
  );
  const records = data?.conferenceRecords ?? [];
  // Tri décroissant par date de début (l'ordre de l'API n'est pas garanti).
  return records.sort((a, b) =>
    (b.startTime ?? "").localeCompare(a.startTime ?? ""),
  );
}

// Liste les transcriptions d'une conférence (souvent 0 ou 1).
export async function listTranscripts(
  token: string,
  conferenceRecordName: string,
): Promise<Transcript[]> {
  const data = await meetGet<{ transcripts?: Transcript[] }>(
    token,
    `${conferenceRecordName}/transcripts`,
  );
  return data?.transcripts ?? [];
}

// Récupère les entrées d'une transcription, paginées, et les normalise au format
// TranscriptSegment du pipeline (start/end en MILLISECONDES, speaker = identifiant
// du participant). La résolution du NOM affichable du participant viendra en J43
// (endpoint participants) — ici on garde l'id de participant comme libellé.
export async function fetchTranscriptSegments(
  token: string,
  transcriptName: string,
): Promise<TranscriptSegment[]> {
  const segments: TranscriptSegment[] = [];
  let pageToken: string | undefined;

  do {
    const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
    const data = await meetGet<{
      transcriptEntries?: TranscriptEntry[];
      nextPageToken?: string;
    }>(token, `${transcriptName}/entries${qs}`);
    if (!data) break;

    for (const e of data.transcriptEntries ?? []) {
      segments.push({
        // En J43 : remplacer par le displayName résolu via participants.get.
        speaker: e.participant ?? "?",
        text: e.text ?? "",
        start: e.startTime ? toMillis(e.startTime) : 0,
        end: e.endTime ? toMillis(e.endTime) : 0,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return segments;
}

// Convertit un timestamp ISO en millisecondes relatives n'a pas de sens sans
// origine ; les entrées Meet portent un timestamp ABSOLU. On renvoie l'epoch ms,
// la normalisation en offset depuis le début de l'appel se fera en J43 au moment
// de construire l'appel. Pour l'instant : epoch ms (suffisant pour l'ordre).
function toMillis(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

// LE point d'entrée haut niveau pour l'UI (livrable J42) : à partir de l'orgId,
// liste les réunions récentes et indique lesquelles ont une transcription
// récupérable. Renvoie [] si non connecté / pas de Workspace / aucune réunion.
export async function listRecentMeetTranscripts(
  orgId: string,
  maxConferences = 10,
): Promise<MeetConferenceSummary[]> {
  const token = await getGoogleToken(orgId);
  if (!token) return [];

  const records = await listConferenceRecords(token, maxConferences);
  const summaries: MeetConferenceSummary[] = [];

  for (const rec of records) {
    const transcripts = await listTranscripts(token, rec.name);
    const t = transcripts[0]; // en pratique 0 ou 1
    summaries.push({
      conferenceRecordName: rec.name,
      startTime: rec.startTime ?? null,
      endTime: rec.endTime ?? null,
      hasTranscript: Boolean(t),
      transcriptName: t?.name ?? null,
      transcriptReady: t?.state === "ENDED" || t?.state === "FILE_GENERATED",
    });
  }

  return summaries;
}
