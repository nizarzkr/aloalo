"use server";

// ============================================================================
// Server actions — Préparer un 1:1 (J35, axe Coacher)
// ============================================================================
// Gating MANAGER/OWNER (les 1:1 sont des données RH sensibles ; un commercial
// n'y a pas accès). Le gating est ici la SEULE barrière côté lecture/écriture,
// car la table coaching_sessions est en RLS server-only (migration 0030) —
// l'orchestrateur écrit via le client admin.
// ============================================================================

import { revalidatePath } from "next/cache";

import {
  generateOneOnOne,
  saveSessionNotes,
  type CoachingSession,
} from "@/lib/coaching/one-on-one";
import { createClient } from "@/lib/supabase/server";
import {
  OneOnOneGenerateSchema,
  OneOnOneNotesSchema,
} from "@/lib/validations";

type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

// Résout l'utilisateur courant + son org, et exige owner|manager.
async function managerCtx(): Promise<
  | { ok: true; orgId: string; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return { ok: false, error: "Organisation introuvable." };
  }
  if (profile.role !== "owner" && profile.role !== "manager") {
    return { ok: false, error: "Réservé aux managers." };
  }
  return { ok: true, orgId: profile.organization_id, userId: user.id };
}

/** Génère (et stocke) un briefing de 1:1 pour un commercial sur une période. */
export async function generateOneOnOneAction(
  repId: string,
  periodType: string,
): Promise<ActionResult<CoachingSession>> {
  const parsed = OneOnOneGenerateSchema.safeParse({ repId, periodType });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }

  const ctx = await managerCtx();
  if (!ctx.ok) return ctx;

  const result = await generateOneOnOne(
    ctx.orgId,
    parsed.data.repId,
    parsed.data.periodType,
    ctx.userId,
  );
  revalidatePath("/dashboard/one-on-ones");

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.session };
}

/** Enregistre les notes manuelles du manager sur un 1:1. */
export async function saveOneOnOneNotesAction(
  sessionId: string,
  notes: string,
): Promise<ActionResult> {
  const parsed = OneOnOneNotesSchema.safeParse({ sessionId, notes });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }

  const ctx = await managerCtx();
  if (!ctx.ok) return ctx;

  const result = await saveSessionNotes(ctx.orgId, parsed.data.sessionId, parsed.data.notes);
  revalidatePath("/dashboard/one-on-ones");

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Enregistrement impossible." };
  }
  return { ok: true, message: "Notes enregistrées." };
}
