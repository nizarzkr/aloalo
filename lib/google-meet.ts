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

// Résout le nom affichable d'un participant (signedinUser / anonymousUser /
// phoneUser ont chacun un displayName). Renvoie null si introuvable.
export async function getParticipantName(
  token: string,
  participantResourceName: string,
): Promise<string | null> {
  const data = await meetGet<{
    signedinUser?: { displayName?: string };
    anonymousUser?: { displayName?: string };
    phoneUser?: { displayName?: string };
  }>(token, participantResourceName);
  return (
    data?.signedinUser?.displayName ??
    data?.anonymousUser?.displayName ??
    data?.phoneUser?.displayName ??
    null
  );
}

// Récupère TOUTES les entrées d'une transcription (paginées), brutes.
export async function fetchTranscriptEntries(
  token: string,
  transcriptName: string,
): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];
  let pageToken: string | undefined;

  do {
    const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
    const data = await meetGet<{
      transcriptEntries?: TranscriptEntry[];
      nextPageToken?: string;
    }>(token, `${transcriptName}/entries${qs}`);
    if (!data) break;
    entries.push(...(data.transcriptEntries ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return entries;
}

export type MeetTranscriptResult = {
  text: string; // "Nom: phrase\n…" (lisible + analysable par Claude)
  segments: TranscriptSegment[]; // start/end RELATIFS au début, en millisecondes
  durationSeconds: number;
  startedAt: string | null; // ISO du début de la 1re prise de parole
};

// PURE (aucune I/O, testable) : normalise des entrées Meet (timestamps ABSOLUS
// ISO) vers le format transcript du pipeline. Les segments portent des temps
// RELATIFS au début (ms, comme AssemblyAI). `nameOf` résout l'identifiant de
// participant en nom affichable (injecté → testable sans réseau).
export function normalizeMeetEntries(
  entries: TranscriptEntry[],
  nameOf: (participant: string | undefined) => string,
): MeetTranscriptResult {
  const sorted = [...entries].sort((a, b) =>
    (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );
  const origin =
    sorted.length && sorted[0].startTime ? Date.parse(sorted[0].startTime) : 0;

  let maxEnd = origin;
  const segments: TranscriptSegment[] = [];
  const lines: string[] = [];

  for (const e of sorted) {
    const name = nameOf(e.participant);
    const startAbs = e.startTime ? Date.parse(e.startTime) : origin;
    const endAbs = e.endTime ? Date.parse(e.endTime) : startAbs;
    const start = Math.max(0, startAbs - origin);
    const end = Math.max(start, endAbs - origin);
    if (endAbs > maxEnd) maxEnd = endAbs;
    segments.push({ speaker: name, text: e.text ?? "", start, end });
    lines.push(`${name}: ${e.text ?? ""}`);
  }

  return {
    text: lines.join("\n"),
    segments,
    durationSeconds: Math.max(0, Math.round((maxEnd - origin) / 1000)),
    startedAt: sorted.length && sorted[0].startTime ? sorted[0].startTime! : null,
  };
}

// Construit le transcript complet d'une réunion : entrées + noms de participants
// résolus (mis en cache) → MeetTranscriptResult prêt pour l'ingestion. Renvoie
// null si la conférence n'a pas de transcription exploitable.
export async function buildMeetTranscript(
  token: string,
  conferenceRecordName: string,
): Promise<MeetTranscriptResult | null> {
  const transcripts = await listTranscripts(token, conferenceRecordName);
  const transcript = transcripts[0];
  if (!transcript) return null;

  const entries = await fetchTranscriptEntries(token, transcript.name);
  if (entries.length === 0) return null;

  // Résout chaque participant une seule fois (cache resource name → nom).
  const cache = new Map<string, string>();
  const distinct = [
    ...new Set(entries.map((e) => e.participant).filter(Boolean) as string[]),
  ];
  for (const p of distinct) {
    cache.set(p, (await getParticipantName(token, p)) ?? "Participant");
  }

  return normalizeMeetEntries(entries, (p) =>
    p ? cache.get(p) ?? "Participant" : "Participant",
  );
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
