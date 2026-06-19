// ============================================================================
// GET /api/pipedrive/oauth/start — démarre la connexion OAuth Pipedrive (J46)
// ============================================================================
// Déclenché par le bouton « Connecter Pipedrive » (Réglages › Intégrations).
// Génère un `state` anti-CSRF, le pose en cookie httpOnly, et redirige l'owner
// vers la page d'autorisation Pipedrive. Au retour, /callback vérifie le state.
//
// Réservé à l'OWNER : seul lui connecte le CRM de l'organisation. Miroir strict
// de /api/hubspot/oauth/start (J38).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizeUrl } from "@/lib/pipedrive-oauth";

export async function GET(req: NextRequest) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Owner check
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "no_org" }, { status: 403 });
  }
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 3. State anti-CSRF → cookie httpOnly + redirection vers Pipedrive.
  const state = randomBytes(32).toString("hex");
  const res = NextResponse.redirect(getAuthorizeUrl(state));
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 min pour finir l'autorisation
  };
  res.cookies.set("pipedrive_oauth_state", state, cookieOpts);
  // Où renvoyer après le callback. Whitelist stricte (jamais une URL libre).
  const returnTo =
    req.nextUrl.searchParams.get("return") === "onboarding"
      ? "/onboarding"
      : "/dashboard/settings/integrations";
  res.cookies.set("pipedrive_oauth_return", returnTo, cookieOpts);
  return res;
}
