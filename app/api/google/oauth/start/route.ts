// ============================================================================
// GET /api/google/oauth/start — démarre la connexion OAuth Google Meet (J42)
// ============================================================================
// Déclenché par le bouton « Connecter Google Meet » (Réglages › Intégrations).
// Génère un `state` anti-CSRF, le pose en cookie httpOnly, et redirige l'owner
// vers la page d'autorisation Google. Au retour, /callback vérifie le state.
//
// Réservé à l'OWNER : seul lui connecte un compte Google pour l'organisation.
// Pattern identique à /api/hubspot/oauth/start (J38).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizeUrl } from "@/lib/google-oauth";

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

  // 3. State anti-CSRF → cookie httpOnly + redirection vers Google.
  const state = randomBytes(32).toString("hex");
  const res = NextResponse.redirect(getAuthorizeUrl(state));
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, // redirection de retour = GET top-level → cookie envoyé
    path: "/",
    maxAge: 600, // 10 min pour finir l'autorisation
  };
  res.cookies.set("google_oauth_state", state, cookieOpts);
  // Où renvoyer après le callback. Whitelist stricte (jamais d'URL libre).
  const returnTo =
    req.nextUrl.searchParams.get("return") === "onboarding"
      ? "/onboarding"
      : "/dashboard/settings/integrations";
  res.cookies.set("google_oauth_return", returnTo, cookieOpts);
  return res;
}
