"use server";

// ============================================================================
// Server action — « À faire » : cocher/décocher une tâche (J37)
// ============================================================================
// Chaque utilisateur gère SES propres tâches (gating user_id = soi-même). La
// table task_completions est RLS server-only → l'écriture passe par le client
// admin dans setTaskDone.
// ============================================================================

import { revalidatePath } from "next/cache";

import { setTaskDone } from "@/lib/tasks/todo";
import { createClient } from "@/lib/supabase/server";
import { TodoToggleSchema } from "@/lib/validations";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleTodoAction(
  callId: string,
  title: string,
  done: boolean,
): Promise<ActionResult> {
  const parsed = TodoToggleSchema.safeParse({ callId, title, done });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) {
    return { ok: false, error: "Organisation introuvable." };
  }

  const res = await setTaskDone(
    profile.organization_id,
    user.id,
    parsed.data.callId,
    parsed.data.title,
    parsed.data.done,
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Enregistrement impossible." };

  revalidatePath("/dashboard/todo");
  revalidatePath("/dashboard"); // la home sales montre aussi les prochaines étapes
  return { ok: true };
}
