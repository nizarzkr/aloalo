/**
 * Client AssemblyAI — région EU
 * Endpoint : https://api.eu.assemblyai.com
 * Modèle   : best (Universal-2) — meilleure qualité pour le français
 * RGPD     : données traitées en Europe, audio supprimé après transcription
 */

const BASE_URL = 'https://api.eu.assemblyai.com'

function getHeaders() {
  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) throw new Error('ASSEMBLYAI_API_KEY manquante')
  return {
    Authorization: key,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TranscriptSegment = {
  speaker: string   // 'A' | 'B' | ...
  text: string
  start: number     // millisecondes
  end: number       // millisecondes
}

export type TranscriptStatus = 'queued' | 'processing' | 'completed' | 'error'

export type AssemblyTranscript = {
  id: string
  status: TranscriptStatus
  text: string | null
  utterances: Array<{
    speaker: string
    text: string
    start: number
    end: number
  }> | null
  audio_duration: number | null  // secondes
  error: string | null
}

// ---------------------------------------------------------------------------
// 1. Uploader un fichier audio depuis une URL publique
//    AssemblyAI accepte aussi des URLs directes — on skip l'upload si on a déjà une URL
// ---------------------------------------------------------------------------

export async function uploadAudio(audioUrl: string): Promise<string> {
  // Si l'URL est déjà publique (Ringover héberge l'audio), on la passe directement
  // Si c'est un fichier local, on devrait d'abord l'uploader via /v2/upload
  // Pour le MVP : Ringover fournit une URL publique → on retourne directement
  return audioUrl
}

// ---------------------------------------------------------------------------
// 2. Lancer une transcription
//    Retourne le transcript_id AssemblyAI (ex: "abc123def456")
// ---------------------------------------------------------------------------

export async function requestTranscription(audioUrl: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v2/transcript`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: 'fr',          // Français
      speaker_labels: true,          // Diarisation : qui parle quand
      speech_model: 'best',          // Universal-2 — meilleure qualité FR
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AssemblyAI requestTranscription error ${res.status}: ${err}`)
  }

  const data = await res.json() as { id: string }
  console.log('[assemblyai] Transcription lancée:', data.id)
  return data.id
}

// ---------------------------------------------------------------------------
// 3. Récupérer le résultat d'une transcription (polling ou après webhook)
// ---------------------------------------------------------------------------

export async function getTranscriptionResult(transcriptId: string): Promise<AssemblyTranscript> {
  const res = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}`, {
    headers: getHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AssemblyAI getTranscriptionResult error ${res.status}: ${err}`)
  }

  return res.json() as Promise<AssemblyTranscript>
}

// ---------------------------------------------------------------------------
// 4. Convertir les utterances AssemblyAI → notre format TranscriptSegment
// ---------------------------------------------------------------------------

export function normalizeSegments(
  utterances: AssemblyTranscript['utterances']
): TranscriptSegment[] {
  if (!utterances) return []
  return utterances.map((u) => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start,
    end: u.end,
  }))
}

// ---------------------------------------------------------------------------
// 5. Calcul du coût indicatif (pour usage_logs)
//    Tarif AssemblyAI EU best : ~0.37 USD/heure = ~0.34 EUR/heure
// ---------------------------------------------------------------------------

export function estimateCostEur(durationSeconds: number): number {
  const durationHours = durationSeconds / 3600
  const costUsd = durationHours * 0.37
  const costEur = costUsd * 0.92  // taux approximatif
  return Math.round(costEur * 10000) / 10000  // 4 décimales
}
