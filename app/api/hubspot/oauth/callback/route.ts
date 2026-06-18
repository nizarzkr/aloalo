// ============================================================================
// GET /api/hubspot/oauth/callback — retour d'autorisation OAuth HubSpot (J38)
// ============================================================================
// HubSpot redirige ici avec ?code&state (ou ?error si l'utilisateur refuse).
// On :
//   1. vérifie le `state` vs le cookie posé par /start (anti-CSRF) ;
//   2. ré-dérive l'org depuis la SESSION (jamais un orgId d'URL) ;
//   3. échange le code contre des jetons → stockage chiffré ;
//   4. récupère le hub_id (portal id) via getTokenInfo, synchronise le tunnel ;
//   5. redirige vers Réglages › Intégrations avec un statut lisible.
//
// Toute erreur dégrade vers une redirection ?hubspot=error (jamais de 500 brut).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  storeTokens,
  getTokenInfo,
} from "@/lib/hubspot-oauth";
import { syncOrgPipelines } from "@/lib/hubspot-pipelines";

const SETTINGS_PATH = "/dashboard/settings/integrations";

function redirectTo(req: NextRequest, status: string): NextResponse {
  // Destination = cookie de retour posé par /start (whitelisté), repli réglages.
  const returnCookie = req.cookies.get("hubspot_oauth_return")?.value;
  const dest =
    returnCookie === "/onboarding" ? "/onboarding" : SETTINGS_PATH;
  const url = new URL(dest, req.url);
  url.searchParams.set("hubspot", status);
  const res = NextResponse.redirect(url);
  // On nettoie les cookies du flux dans tous les cas.
  res.cookies.set("hubspot_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("hubspot_oauth_return", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // L'utilisateur a refusé l'autorisation côté HubSpot.
  if (error) return redirectTo(req, "denied");

  // 1. Vérif state anti-CSRF
  const cookieState = req.cookies.get("hubspot_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo(req, "error");
  }

  // 2. Org depuis la session (l'owner est toujours connecté à Aloalo dans cet
  //    onglet — on ne fait jamais confiance à un identifiant venu de l'URL).
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

    // 4. hub_id (= portal id) sans saisie manuelle + sync du tunnel (J27).
    const info = await getTokenInfo(tokens.accessToken);
    if (info?.hubId) {
      await admin
        .from("organizations")
        .update({ hubspot_portal_id: info.hubId })
        .eq("id", orgId);
    }
    // Best-effort : ne casse pas la connexion si la lecture du tunnel échoue.
    await syncOrgPipelines(orgId, tokens.accessToken);

    return redirectTo(req, "connected");
  } catch (err) {
    console.error("[hubspot-oauth] callback failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return redirectTo(req, "error");
  }
}
