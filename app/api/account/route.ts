// ============================================================================
// DELETE /api/account — Droit à l'effacement (RGPD art. 17)
// ============================================================================
// L'utilisateur connecté demande la suppression définitive de son compte ET
// de l'organisation associée (le MVP est mono-tenant : 1 user = 1 org dans la
// quasi-totalité des cas).
//
// Sécurité :
//   - Auth obligatoire (getUser via cookie session).
//   - Garde-fou : si d'AUTRES membres existent dans l'org, on refuse (409)
//     pour éviter qu'un owner supprime accidentellement les données de toute
//     son équipe. Il devra d'abord retirer les autres membres via
//     /dashboard/team (qui utilise le flux détachement + cron 90j).
//
// Ordre de suppression (volontairement explicite — les cascades FK
// suffiraient mais on garde la traçabilité dans les logs serveur) :
//   1. analyses        (cascade depuis calls + via organization_id)
//   2. calls
//   3. usage_logs
//   4. invitations
//   5. profiles        (le ON DELETE CASCADE depuis auth.users couvrirait aussi)
//   6. organizations
//   7. auth.users      (via admin.deleteUser — supprime la session/identité)
// ============================================================================

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export async function DELETE() {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();

  // 2. Récupérer le profil + org du user
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "profile_not_found" },
      { status: 404 },
    );
  }

  const orgId = profile.organization_id;

  // 3. Si le profil est déjà détaché (organization_id NULL via migration 0005),
  //    on supprime juste le profile + le compte auth — pas d'org à nuke.
  if (!orgId) {
    await admin.from("profiles").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id);
    console.log("[account/delete] profil détaché supprimé:", user.id);
    return NextResponse.json({ success: true });
  }

  // 4. Garde-fou multi-tenant : compter les autres membres actifs de l'org.
  const { count: otherMembers, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .neq("id", user.id);

  if (countError) {
    console.error("[account/delete] count members error:", countError);
    return NextResponse.json({ error: "count_failed" }, { status: 500 });
  }

  if ((otherMembers ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "org_has_other_members",
        message:
          "Retirez d'abord les autres membres de votre organisation depuis Équipe avant de supprimer votre compte.",
      },
      { status: 409 },
    );
  }

  // 5. Suppression en cascade — ordre explicite pour la traçabilité.
  //    En cas d'erreur on s'arrête et on remonte 500 : la cascade FK rattrape
  //    ce qui n'a pas été supprimé si on relance, mais on veut l'erreur visible.
  async function runDelete(
    table: string,
    promise: PromiseLike<{ error: { message: string } | null }>,
  ): Promise<NextResponse | null> {
    const { error } = await promise;
    if (error) {
      console.error(`[account/delete] erreur sur ${table}:`, error.message);
      return NextResponse.json(
        { error: `delete_failed_${table}` },
        { status: 500 },
      );
    }
    return null;
  }

  const failure =
    (await runDelete(
      "analyses",
      admin.from("analyses").delete().eq("organization_id", orgId),
    )) ??
    (await runDelete(
      "calls",
      admin.from("calls").delete().eq("organization_id", orgId),
    )) ??
    (await runDelete(
      "usage_logs",
      admin.from("usage_logs").delete().eq("organization_id", orgId),
    )) ??
    (await runDelete(
      "invitations",
      admin.from("invitations").delete().eq("organization_id", orgId),
    )) ??
    (await runDelete(
      "profiles",
      admin.from("profiles").delete().eq("id", user.id),
    )) ??
    (await runDelete(
      "organizations",
      admin.from("organizations").delete().eq("id", orgId),
    ));

  if (failure) return failure;

  // 6. Supprimer le compte auth (identité Supabase). Cette étape révoque
  //    toutes les sessions du user.
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("[account/delete] auth.deleteUser error:", authError);
    return NextResponse.json({ error: "auth_delete_failed" }, { status: 500 });
  }

  console.log(
    "[account/delete] ✅ compte + org supprimés:",
    user.id,
    "org:",
    orgId,
  );
  return NextResponse.json({ success: true });
}
