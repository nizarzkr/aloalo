// ============================================================================
// /dashboard/users/[id] — fiche profil d'un commercial (J8 étape 5)
// ============================================================================
// Server Component. RLS scope déjà sur l'org du JWT, mais on filtre aussi
// explicitement par organization_id pour défense en profondeur.
// ============================================================================

import { notFound, redirect } from "next/navigation";

import { UserProfile } from "@/components/dashboard/user-profile";
import { createClient } from "@/lib/supabase/server";
import { summarizeDimensions } from "@/lib/metrics/dimensions-summary";

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
  const [analyzedCallsRes, allDimsRes, allDurationsRes] = await Promise.all([
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
    // Moyenne calculée sur TOUTES les analyses du user, pas juste les 30
    // dernières — plus représentatif.
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
  ]);

  const analyzedCalls = analyzedCallsRes.data ?? [];
  // Nb de dimensions validées (0-5) par analyse → remplace le score /100 (J25).
  const allValidated = (allDimsRes.data ?? [])
    .map((a) => summarizeDimensions(a.dimensions)?.validated)
    .filter((v): v is number => typeof v === "number");
  const totalDurationSeconds = (allDurationsRes.data ?? []).reduce(
    (sum, c) => sum + (c.duration_seconds ?? 0),
    0,
  );

  // Moyenne de dimensions validées, 1 décimale (ex. « 3,2 / 5 »).
  const avgValidated =
    allValidated.length > 0
      ? Math.round(
          (allValidated.reduce((s, v) => s + v, 0) / allValidated.length) * 10,
        ) / 10
      : null;

  return (
    <UserProfile
      profile={targetProfile}
      calls={analyzedCalls.map((c) => {
        // L'embed FK 1-to-1 peut renvoyer objet ou tableau selon le client.
        const rel = c.analyses as
          | { dimensions: unknown }
          | { dimensions: unknown }[]
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
          dimensions: analysis?.dimensions ?? null,
        };
      })}
      analyzedCount={allValidated.length}
      avgValidated={avgValidated}
      totalDurationSeconds={totalDurationSeconds}
    />
  );
}
