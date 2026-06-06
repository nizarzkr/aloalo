// ============================================================================
// /dashboard/users/[id] — fiche profil d'un commercial (J8 étape 5)
// ============================================================================
// Server Component. RLS scope déjà sur l'org du JWT, mais on filtre aussi
// explicitement par organization_id pour défense en profondeur.
// ============================================================================

import { notFound, redirect } from "next/navigation";

import { UserProfile } from "@/components/dashboard/user-profile";
import { createClient } from "@/lib/supabase/server";

const ANALYZED_CALLS_LIMIT = 30;

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
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const orgId = viewerProfile?.organization_id ?? null;
  if (!orgId) notFound();

  // 1. Profil cible — doit être dans la même org que le viewer
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!targetProfile) notFound();

  // 2 & 3. Appels analysés (chrono ascendant pour la courbe) + agrégats globaux
  //        sur l'historique complet du commercial.
  const [analyzedCallsRes, allScoresRes, allDurationsRes] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "id, callee_number, contact_name, company_name, deal_name, started_at, created_at, duration_seconds, status, analyses ( score_global )",
      )
      .eq("organization_id", orgId)
      .eq("user_id", id)
      .eq("status", "analyzed")
      .order("created_at", { ascending: true })
      .limit(ANALYZED_CALLS_LIMIT),
    // Score moyen calculé sur TOUTES les analyses du user, pas juste les 30
    // dernières — plus représentatif.
    supabase
      .from("analyses")
      .select("score_global, calls!inner ( user_id )")
      .eq("organization_id", orgId)
      .eq("calls.user_id", id),
    supabase
      .from("calls")
      .select("duration_seconds")
      .eq("organization_id", orgId)
      .eq("user_id", id)
      .eq("status", "analyzed"),
  ]);

  const analyzedCalls = analyzedCallsRes.data ?? [];
  const allScores = (allScoresRes.data ?? [])
    .map((a) => a.score_global)
    .filter((v): v is number => typeof v === "number");
  const totalDurationSeconds = (allDurationsRes.data ?? []).reduce(
    (sum, c) => sum + (c.duration_seconds ?? 0),
    0,
  );

  const avgScore =
    allScores.length > 0
      ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
      : null;

  return (
    <UserProfile
      profile={targetProfile}
      calls={analyzedCalls.map((c) => {
        // L'embed FK 1-to-1 peut renvoyer objet ou tableau selon le client.
        const rel = c.analyses as
          | { score_global: number | null }
          | { score_global: number | null }[]
          | null;
        const analysis = Array.isArray(rel) ? rel[0] : rel;
        return {
          id: c.id,
          callee_number: c.callee_number,
          contact_name: c.contact_name,
          company_name: c.company_name,
          deal_name: c.deal_name,
          started_at: c.started_at,
          created_at: c.created_at,
          duration_seconds: c.duration_seconds,
          status: c.status,
          score_global: analysis?.score_global ?? null,
        };
      })}
      analyzedCount={allScores.length}
      avgScore={avgScore}
      totalDurationSeconds={totalDurationSeconds}
    />
  );
}
