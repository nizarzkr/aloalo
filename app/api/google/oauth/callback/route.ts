// ============================================================================
// GET /api/google/oauth/callback — retour d'autorisation OAuth Google (J42)
// ============================================================================
// Google redirige ici avec ?code&state (ou ?error si l'utilisateur refuse).
// On :
//   1. vérifie le `state` vs le cookie posé par /start (anti-CSRF) ;
//   2. ré-dérive l'org depuis la SESSION (jamais un orgId d'URL) ;
//   3. échange le code contre des jetons → stockage chiffré ;
//   4. récupère l'email du compte connecté (affichage) ;
//   5. redirige vers Réglages › Intégrations avec un statut lisible.
//
// Toute erreur dégrade vers ?google=error (jamais de 500 brut).
// Pattern identique à /api/hubspot/oauth/callback (J38).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  storeTokens,
  storeGoogleEmail,
  getUserEmail,
} from "@/lib/google-oauth";

const SETTINGS_PATH = "/dashboard/settings/integrations";

function redirectTo(req: NextRequest, status: string): NextResponse {
  const returnCookie = req.cookies.get("google_oauth_return")?.value;
  const dest = returnCookie === "/onboarding" ? "/onboarding" : SETTINGS_PATH;
  const url = new URL(dest, req.url);
  url.searchParams.set("google", status);
  const res = NextResponse.redirect(url);
  // On nettoie les cookies du flux dans tous les cas.
  res.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("google_oauth_return", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // L'utilisateur a refusé l'autorisation côté Google.
  if (error) return redirectTo(req, "denied");

  // 1. Vérif state anti-CSRF
  const cookieState = req.cookies.get("google_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo(req, "error");
  }

  // 2. Org depuis la session (jamais un identifiant venu de l'URL).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectTo(req, "error");

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

  const orgId = profile?.organization_id;
  if (!orgId || profile?.role !== "owner") return redirectTo(req, "error");

  try {
    // 3. Échange code → jetons + stockage chiffré.
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) return redirectTo(req, "error");
    await storeTokens(orgId, tokens);

    // 4. Email du compte connecté (best-effort, pour l'affichage).
    const email = await getUserEmail(tokens.accessToken);
    await storeGoogleEmail(orgId, email);

    return redirectTo(req, "connected");
  } catch (err) {
    console.error("[google-oauth] callback failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return redirectTo(req, "error");
  }
}
