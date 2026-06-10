"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  authLimiter,
  checkRateLimit,
  getClientKeyFromHeaders,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { LoginSchema, SignupSchema } from "@/lib/validations";

// Messages d'erreur génériques pour l'auth. On ne reflète JAMAIS le message
// brut de Supabase au navigateur : ça permettrait l'énumération de comptes
// ("User already registered") et fuite l'état interne. On logge le brut côté
// serveur (Sentry) pour le debug, et on renvoie un message neutre.
const GENERIC_SIGNUP_ERROR =
  "Impossible de créer le compte. Vérifiez vos informations ou réessayez.";
const GENERIC_LOGIN_ERROR = "Identifiants invalides.";

export async function signup(formData: FormData) {
  // Rate limit auth — freine le spam de signup (chaque signup crée org +
  // profile via trigger et envoie un email de confirmation).
  const headerList = await headers();
  const rl = await checkRateLimit(authLimiter, getClientKeyFromHeaders(headerList));
  if (!rl.allowed) {
    redirect(
      `/signup?error=${encodeURIComponent(
        "Trop de tentatives. Réessayez dans une minute.",
      )}`,
    );
  }

  // Validation serveur : le client a un minLength=8 contournable au curl.
  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
    organization_name: formData.get("organization_name"),
  });
  if (!parsed.success) {
    // Premier message zod, déjà en français et sans info sensible.
    const msg = parsed.error.issues[0]?.message ?? GENERIC_SIGNUP_ERROR;
    redirect(`/signup?error=${encodeURIComponent(msg)}`);
  }
  const { email, password, full_name, organization_name } = parsed.data;

  const supabase = await createClient();

  // emailRedirectTo fixe la destination du lien dans l'email de confirmation.
  // Sans ça, Supabase retombe sur "Site URL" (la home) — ce qu'on veut éviter.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Lus par le trigger handle_new_user pour créer org + profile.
      data: {
        full_name,
        organization_name,
      },
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    Sentry.captureException(error, { tags: { area: "auth", action: "signup" } });
    redirect(`/signup?error=${encodeURIComponent(GENERIC_SIGNUP_ERROR)}`);
  }

  revalidatePath("/", "layout");

  // Si Supabase ouvre la session direct (confirm-email OFF, mode dev) → dashboard.
  // Sinon (confirm-email ON, mode prod) → page d'attente avec rappel email.
  if (data.session) {
    redirect("/dashboard");
  }
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function login(formData: FormData) {
  // Rate limit auth — freine le credential-stuffing (brute-force d'un mot de
  // passe contre une adresse connue).
  const headerList = await headers();
  const rl = await checkRateLimit(authLimiter, getClientKeyFromHeaders(headerList));
  if (!rl.allowed) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Trop de tentatives. Réessayez dans une minute.",
      )}`,
    );
  }

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(GENERIC_LOGIN_ERROR)}`);
  }
  const { email, password } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    Sentry.captureException(error, { tags: { area: "auth", action: "login" } });
    redirect(`/login?error=${encodeURIComponent(GENERIC_LOGIN_ERROR)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Vide le cache de toutes les routes pour ne pas laisser fuiter de données
  // de la session précédente vers une autre.
  revalidatePath("/", "layout");
  redirect("/login");
}
