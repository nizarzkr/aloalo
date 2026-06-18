// ============================================================================
// /dashboard/users/[id] — Profil de coaching d'un commercial (J36, ex-fiche J8)
// ============================================================================
// Vue LONGITUDINALE du coaching (≠ le 1:1 ponctuel de J35) : point fort + axe de
// progression récurrent (agrégat des dimensions sur tout l'historique), citations
// d'exemple, courbe de progression, historique des 1:1. Ton bienveillant.
//
// Gating : owner/manager voient n'importe quel membre ; un sales ne voit QUE sa
// propre fiche (transparence). L'historique des 1:1 (notes de prep) n'est servi
// qu'aux owner/manager.
// ============================================================================

import { notFound, redirect } from "next/navigation";

import { UserProfile } from "@/components/dashboard/user-profile";
import { createClient } from "@/lib/supabase/server";
import { getRepSessions } from "@/lib/coaching/one-on-one";
import {
  aggregateDimensionStats,
  pickProgressionAxis,
  pickStrengthAxis,
  safeDimensionStatus,
  summarizeDimensions,
} from "@/lib/metrics/dimensions-summary";
import type { DimensionEval, DimensionKey } from "@/lib/claude";

const ANALYZED_CALLS_LIMIT = 50;

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const orgId = viewerProfile?.organization_id ?? null;
  if (!orgId) notFound();

  // Gating : un sales ne peut consulter QUE sa propre fiche (transparence) ;
  // owner/manager peuvent consulter n'importe quel membre.
  const canCoach =
    viewerProfile?.role === "owner" || viewerProfile?.role === "manager";
  if (!canCoach && id !== user.id) notFound();

  // 1. Profil cible — doit être dans la même org que le viewer
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!targetProfile) notFound();

  // 2-4. Appels analysés (ASC pour la courbe + citations) + agrégats globaux +
  //      durées + historique des 1:1 (owner/manager seulement).
  const [analyzedCallsRes, allDimsRes, allDurationsRes, sessions] =
    await Promise.all([
      supabase
        .from("calls")
        .select(
          "id, callee_number, contact_name, company_name, deal_name, started_at, created_at, duration_seconds, status, analyses ( dimensions )",
        )
        .eq("organization_id", orgId)
        .eq("user_id", id)
        .eq("status", "analyzed")
        .order("created_at", { ascending: true })
        .limit(ANALYZED_CALLS_LIMIT),
      // Agrégats calculés sur TOUTES les analyses du user (plus représentatif).
      supabase
        .from("analyses")
        .select("dimensions, calls!inner ( user_id )")
        .eq("organization_id", orgId)
        .eq("calls.user_id", id),
      supabase
        .from("calls")
        .select("duration_seconds")
        .eq("organization_id", orgId)
        .eq("user_id", id)
        .eq("status", "analyzed"),
      canCoach ? getRepSessions(orgId, id) : Promise.resolve([]),
    ]);

  const analyzedCalls = analyzedCallsRes.data ?? [];
  const allDims = (allDimsRes.data ?? []).map((a) => a.dimensions);

  // Nb de dimensions validées (0-5) par analyse → KPI moyenne (J25).
  const allValidated = allDims
    .map((d) => summarizeDimensions(d)?.validated)
    .filter((v): v is number => typeof v === "number");
  const totalDurationSeconds = (allDurationsRes.data ?? []).reduce(
    (sum, c) => sum + (c.duration_seconds ?? 0),
    0,
  );
  const avgValidated =
    allValidated.length > 0
      ? Math.round(
          (allValidated.reduce((s, v) => s + v, 0) / allValidated.length) * 10,
        ) / 10
      : null;

  // Point fort + axe de progression récurrent (sur tout l'historique).
  const stats = aggregateDimensionStats(allDims);
  const progression = pickProgressionAxis(stats);
  const strength = pickStrengthAxis(stats);

  // Normalise l'embed FK analyses (objet ou tableau).
  const dimsOf = (rel: unknown) => {
    const a = (Array.isArray(rel) ? rel[0] : rel) as { dimensions: unknown } | null;
    return a?.dimensions ?? null;
  };

  // Citations d'exemple pour l'axe de progression : extraits (evidence) des appels
  // où cet axe est manqué/partiel, les plus récents d'abord (max 3).
  const citations: {
    callId: string;
    contact: string;
    date: string;
    quote: string;
  }[] = [];
  if (progression) {
    for (const c of [...analyzedCalls].reverse()) {
      if (citations.length >= 3) break;
      const dims = dimsOf(c.analyses);
      if (!Array.isArray(dims)) continue;
      const dim = (dims as DimensionEval[]).find((d) => d?.key === progression.key);
      if (!dim) continue;
      const status = safeDimensionStatus(dim.status);
      const quote = typeof dim.evidence === "string" ? dim.evidence.trim() : "";
      if ((status === "manqué" || status === "partiel") && quote.length > 0) {
        citations.push({
          callId: c.id,
          contact:
            c.contact_name ?? c.callee_number ?? c.company_name ?? "Appel",
          date: c.started_at ?? c.created_at,
          quote,
        });
      }
    }
  }

  // Historique des 1:1 sérialisé (date + axe travaillé), owner/manager only.
  const oneOnOnes = sessions.map((s) => ({
    id: s.id,
    date: s.created_at,
    focusAxis: s.snapshot?.brief?.focus?.axis_label ?? null,
  }));

  return (
    <UserProfile
      profile={targetProfile}
      calls={analyzedCalls.map((c) => ({
        id: c.id,
        callee_number: c.callee_number,
        contact_name: c.contact_name,
        company_name: c.company_name,
        deal_name: c.deal_name,
        started_at: c.started_at,
        created_at: c.created_at,
        duration_seconds: c.duration_seconds,
        status: c.status,
        dimensions: dimsOf(c.analyses),
      }))}
      analyzedCount={allValidated.length}
      avgValidated={avgValidated}
      totalDurationSeconds={totalDurationSeconds}
      strengthKey={(strength?.key as DimensionKey | undefined) ?? null}
      progressionKey={(progression?.key as DimensionKey | undefined) ?? null}
      citations={citations}
      oneOnOnes={oneOnOnes}
      canCoach={canCoach}
    />
  );
}
