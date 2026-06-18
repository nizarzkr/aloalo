// ============================================================================
// GET /api/hubspot/oauth/start — démarre la connexion OAuth HubSpot (J38)
// ============================================================================
// Déclenché par le bouton « Connecter HubSpot » (Réglages › Intégrations).
// Génère un `state` anti-CSRF, le pose en cookie httpOnly, et redirige l'owner
// vers la page d'autorisation HubSpot. Au retour, /callback vérifie le state.
//
// Réservé à l'OWNER : seul lui peut connecter le CRM de l'organisation (même
// règle que updateHubspotSettings).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizeUrl } from "@/lib/hubspot-oauth";

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

  // 3. State anti-CSRF → cookie httpOnly + redirection vers HubSpot.
  const state = randomBytes(32).toString("hex");
  const res = NextResponse.redirect(getAuthorizeUrl(state));
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, // la redirection de retour est un GET top-level → cookie envoyé
    path: "/",
    maxAge: 600, // 10 min pour finir l'autorisation
  };
  res.cookies.set("hubspot_oauth_state", state, cookieOpts);
  // Où renvoyer après le callback : depuis l'onboarding (wizard) ou les réglages.
  // Whitelist stricte (on ne fait jamais confiance à une URL libre).
  const returnTo =
    req.nextUrl.searchParams.get("return") === "onboarding"
      ? "/onboarding"
      : "/dashboard/settings/integrations";
  res.cookies.set("hubspot_oauth_return", returnTo, cookieOpts);
  return res;
}
