// ============================================================================
// GET /api/cron/poll-google-meet — import auto des réunions Meet transcrites
// ============================================================================
// J43. Google Meet n'envoie pas de webhook « réunion terminée » → on POLLE.
// Pour chaque org connectée à Google, on liste les réunions récentes, on ignore
// celles déjà importées (idempotence : un appel existe déjà avec ce
// provider_call_id), et on ingère les nouvelles via la couche d'ingestion
// commune (lib/ingestion) avec leur transcription native Meet (providedTranscript,
// coût 0). Le pipeline enchaîne ensuite analyse + enrichissement comme un appel.
//
// Auth : route service key (bypass RLS) → vérifie CRON_SECRET (Bearer),
// fail-closed, comme /api/cron/sweep-stuck-calls. Planifié dans vercel.json.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { getGoogleToken } from "@/lib/google-oauth";
import { listConferenceRecords, buildMeetTranscript } from "@/lib/google-meet";
import { ingestRecording } from "@/lib/ingestion/ingest";

export const dynamic = "force-dynamic";

// Nombre de réunions récentes inspectées par org à chaque passage. L'import est
// idempotent (index unique) → on peut re-balayer les mêmes sans risque ; on
// borne juste pour ne pas scanner tout l'historique à chaque tick.
const MAX_CONFERENCES_PER_ORG = 15;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();

  // Orgs connectées à Google (présence d'un refresh token chiffré).
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id")
    .not("google_refresh_token", "is", null);

  if (error) {
    console.error("[poll-google-meet] erreur select orgs:", error);
    return NextResponse.json({ error: "select_failed" }, { status: 500 });
  }

  let imported = 0;
  let skipped = 0;

  for (const org of orgs ?? []) {
    const orgId = org.id as string;
    try {
      const token = await getGoogleToken(orgId);
      if (!token) continue;

      const records = await listConferenceRecords(token, MAX_CONFERENCES_PER_ORG);

      for (const rec of records) {
        // Déjà importée ? (idempotence en amont : on évite de re-fetcher les
        // entrées d'une réunion déjà ingérée, qui coûte plusieurs appels API.)
        const { data: existing } = await supabase
          .from("calls")
          .select("id")
          .eq("organization_id", orgId)
          .eq("provider_call_id", rec.name)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        // Transcription native Meet (null si pas/plus de transcription dispo).
        const transcript = await buildMeetTranscript(token, rec.name);
        if (!transcript || transcript.segments.length === 0) {
          skipped++;
          continue;
        }

        const result = await ingestRecording({
          recording: {
            provider: "google_meet",
            providerCallId: rec.name,
            organizationId: orgId,
            durationSeconds: transcript.durationSeconds,
            startedAt: transcript.startedAt ?? rec.startTime ?? null,
            calleeNumber: null,
            audioUrl: null,
            userId: null,
            providedTranscript: {
              text: transcript.text,
              segments: transcript.segments,
              duration_seconds: transcript.durationSeconds,
            },
          },
          triggerBaseUrl: req.url,
        });

        if (result.outcome === "inserted") imported++;
        else skipped++;
      }
    } catch (err) {
      console.error("[poll-google-meet] erreur org", orgId, err);
      Sentry.captureException(err, {
        tags: { route: "/api/cron/poll-google-meet" },
        extra: { orgId },
      });
    }
  }

  console.log(`[poll-google-meet] terminé — importées:${imported} ignorées:${skipped}`);
  return NextResponse.json({ ok: true, imported, skipped });
}
