// ============================================================================
// /dashboard/team — gestion d'équipe (J8) + leaderboard 7j (J11)
// ============================================================================
// Server Component : on charge en parallèle membres + invitations pending, on
// récupère un profil courant pour piloter le bouton "Inviter", puis on calcule
// le classement 7j à partir des analyses des 14 derniers jours.
//
// Le calcul du leaderboard fait UNE seule requête sur les 14 derniers jours
// (admin client) puis bucketise côté Node en deux fenêtres de 7 jours :
//   - recent   = J-7  → maintenant
//   - previous = J-14 → J-7
// Un delta < -10 pts entre les deux moyennes déclenche l'alerte "en chute".
// ============================================================================

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import {
  TeamLeaderboard,
  type LeaderboardEntry,
} from "@/components/dashboard/team-leaderboard";
import { TeamView } from "@/components/dashboard/team-view";
import { createClient } from "@/lib/supabase/server";

// Seuil de chute exprimé en points de score moyen (sur 100).
const DROP_THRESHOLD_POINTS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

type CallRow = {
  user_id: string | null;
  created_at: string;
  // L'embed FK 1-to-1 peut renvoyer objet ou tableau selon le client Supabase.
  analyses:
    | { score_global: number | null }
    | { score_global: number | null }[]
    | null;
};

function extractScore(row: CallRow): number | null {
  const rel = row.analyses;
  const analysis = Array.isArray(rel) ? rel[0] : rel;
  const score = analysis?.score_global;
  return typeof score === "number" ? score : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profil courant — on a besoin de role + org pour filtrer la suite.
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single();

  if (!currentProfile?.organization_id) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <p className="text-sm text-muted-foreground">
          Impossible de charger votre organisation.
        </p>
      </div>
    );
  }

  const orgId = currentProfile.organization_id;
  // On utilise `new Date()` (et non Date.now()) pour respecter la règle de
  // pureté React eslint — les Server Components doivent éviter les fonctions
  // impures directes même si en pratique chaque rendu est unique.
  const nowDate = new Date();
  const nowMs = nowDate.getTime();
  const nowIso = nowDate.toISOString();
  const recentStartMs = nowMs - 7 * DAY_MS;
  const previousStartMs = nowMs - 14 * DAY_MS;

  // Admin client : on bypasse la RLS pour le leaderboard, avec filtre explicite
  // `organization_id = orgId` en défense en profondeur (cf. brief J11).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const [membersRes, pendingRes, leaderboardCallsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, created_at, expires_at")
      .eq("organization_id", orgId)
      .is("accepted_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false }),
    admin
      .from("calls")
      .select("user_id, created_at, analyses ( score_global )")
      .eq("organization_id", orgId)
      .eq("status", "analyzed")
      .gte("created_at", new Date(previousStartMs).toISOString()),
  ]);

  const members = membersRes.data ?? [];

  // Bucketise les scores par user_id sur les deux fenêtres de 7j.
  const buckets = new Map<
    string,
    { recent: number[]; previous: number[] }
  >();

  for (const row of (leaderboardCallsRes.data ?? []) as CallRow[]) {
    if (!row.user_id) continue;
    const score = extractScore(row);
    if (score === null) continue;

    const t = new Date(row.created_at).getTime();
    const bucket = buckets.get(row.user_id) ?? {
      recent: [],
      previous: [],
    };
    if (t >= recentStartMs) {
      bucket.recent.push(score);
    } else {
      bucket.previous.push(score);
    }
    buckets.set(row.user_id, bucket);
  }

  const leaderboardEntries: LeaderboardEntry[] = members.map((p) => {
    const bucket = buckets.get(p.id) ?? { recent: [], previous: [] };
    const scoreRecentRaw = average(bucket.recent);
    const scorePreviousRaw = average(bucket.previous);

    // Pas d'appels sur 7j → pas d'alerte (cf. brief).
    const isDropping =
      scoreRecentRaw !== null &&
      scorePreviousRaw !== null &&
      scoreRecentRaw - scorePreviousRaw < -DROP_THRESHOLD_POINTS;

    return {
      profileId: p.id,
      fullName: p.full_name,
      email: p.email,
      scoreRecent:
        scoreRecentRaw !== null ? Math.round(scoreRecentRaw) : null,
      callsCountRecent: bucket.recent.length,
      isDropping,
    };
  });

  // Tri : meilleur score 7j d'abord, puis volume d'appels comme tie-breaker.
  // Les profils sans appel sur 7j (scoreRecent null) tombent en fin de liste,
  // triés alphabétiquement pour rester lisible.
  leaderboardEntries.sort((a, b) => {
    if (a.scoreRecent === null && b.scoreRecent === null) {
      const an = a.fullName?.trim() || a.email;
      const bn = b.fullName?.trim() || b.email;
      return an.localeCompare(bn);
    }
    if (a.scoreRecent === null) return 1;
    if (b.scoreRecent === null) return -1;
    if (b.scoreRecent !== a.scoreRecent) return b.scoreRecent - a.scoreRecent;
    return b.callsCountRecent - a.callsCountRecent;
  });

  return (
    <TeamView
      members={members}
      pending={pendingRes.data ?? []}
      isOwner={currentProfile.role === "owner"}
      currentUserId={user.id}
      leaderboard={<TeamLeaderboard entries={leaderboardEntries} />}
    />
  );
}
