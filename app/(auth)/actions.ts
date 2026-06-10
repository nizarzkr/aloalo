"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  authLimiter,
  checkRateLimit,
  getClientKeyFromHeaders,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

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

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  const organizationName = String(formData.get("organization_name") ?? "");

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
        full_name: fullName,
        organization_name: organizationName,
      },
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
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

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
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
