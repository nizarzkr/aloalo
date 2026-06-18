// ============================================================================
// lib/ingestion/types.ts — Contrat normalisé d'ingestion d'un enregistrement.
// ============================================================================
// Socle de l'abstraction « source d'enregistrement » (J41). Chaque source
// (Ringover, Aircall, Google Meet, Zoom, simulation) a son propre format de
// webhook/API et sa propre auth. Un ADAPTATEUR par source traduit ce format
// vers la forme `NormalizedRecording` ci-dessous, puis appelle ingestRecording()
// (cf. lib/ingestion/ingest.ts). Toute la logique COMMUNE (insertion idempotente,
// déclenchement de la transcription) vit en aval et ne connaît QUE cette forme.
// ============================================================================

import type { TranscriptSegment } from '@/lib/assemblyai'

// Sources d'enregistrement supportées (→ colonne calls.provider).
// NB : 'google_meet' et 'zoom' sont déjà déclarés ici pour que l'abstraction les
// accueille, mais AUCUNE source ne les écrit encore en J41 — leur ajout à la
// contrainte CHECK de calls.provider se fera dans la migration du jour où on
// branche réellement la visio (Meet J42). 'ringover'/'aircall'/'simulated' sont
// déjà autorisés en base (migration 0001).
export type IngestionProvider =
  | 'ringover'
  | 'aircall'
  | 'google_meet'
  | 'zoom'
  | 'simulated'

// Transcript de simulation passé tel quel au pipeline (mode dev/démo, coût 0).
// Forme alignée sur ce que /api/transcribe attend en mode simulation.
export type SimTranscript = {
  text: string
  segments: TranscriptSegment[]
  duration_seconds: number
  title?: string
}

// Forme NORMALISÉE d'un enregistrement, indépendante de la source.
//
// Familles de sources :
//  - téléphonie (ringover, aircall) : calleeNumber renseigné, audioUrl résolu
//    par l'adaptateur (API du provider) avant l'appel à ingestRecording.
//  - visio (google_meet, zoom) : calleeNumber null, audioUrl récupéré via l'API
//    d'enregistrement de la plateforme.
//  - simulated : pas d'audio, simTranscript fourni (bypass AssemblyAI).
export type NormalizedRecording = {
  // Source de l'enregistrement.
  provider: IngestionProvider
  // Identifiant de l'appel/réunion côté source (→ provider_call_id). Clé
  // d'idempotence : un replay du même id réel ne crée pas de doublon.
  providerCallId: string
  // Org Aloalo destinataire — DÉJÀ RÉSOLUE par l'adaptateur de façon sûre
  // (jamais depuis un champ non authentifié du body). On ne la (re)dérive pas ici.
  organizationId: string
  // Durée en secondes (null toléré : la colonne est nullable).
  durationSeconds: number | null
  // Début de l'appel/réunion, ISO (null toléré).
  startedAt: string | null
  // Numéro appelé (téléphonie). Null pour une visio.
  calleeNumber?: string | null
  // URL audio à transcrire. Téléphonie : résolue par l'adaptateur. Null si on la
  // récupérera plus tard côté /api/transcribe, ou en mode simulation.
  audioUrl?: string | null
  // Rep propriétaire (profile.id). Null tant que le mapping agent→profile n'existe pas.
  userId?: string | null
  // Identité CRM pré-câblée (simulateur / démo). Null en réel : c'est
  // l'enrichissement HubSpot qui remplira ces colonnes plus tard.
  contactName?: string | null
  companyName?: string | null
  dealName?: string | null
  dealId?: string | null
  // Transcript de simulation (mode dev). Présent ⇒ provider 'simulated', bypass
  // AssemblyAI (coût 0).
  simTranscript?: SimTranscript | null
}

export type IngestOutcome = 'inserted' | 'duplicate' | 'error'

export type IngestResult = {
  outcome: IngestOutcome
  // Présent uniquement si outcome === 'inserted'.
  callId?: string
}
