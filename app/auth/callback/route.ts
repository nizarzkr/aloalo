import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

// Callback de confirmation email Supabase. Le lien dans l'email pointe ici
// avec, selon le flow Supabase, soit ?code=... (PKCE, défaut @supabase/ssr),
// soit ?token_hash=...&type=signup (flow legacy). On gère les deux et on
// pose les cookies de session via le client server avant de rediriger.
//
// Auto-login : sur succès, l'utilisateur arrive sur /dashboard déjà connecté.
// Sur échec, retour à /login avec un message d'erreur visible.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession:", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] verifyOtp:", error.message);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Lien de confirmation invalide ou expiré. Réessayez de vous connecter.",
    )}`,
  );
}
