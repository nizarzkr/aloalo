// ============================================================================
// /dashboard/one-on-ones — Préparer un 1:1 (J35, axe Coacher)
// ============================================================================
// Page serveur : gating owner/manager (un commercial n'y a pas accès) ; charge
// les membres de l'org (sélecteur de commercial) ; lit ?rep=&period= ; si un
// commercial est sélectionné, charge sa dernière session + son historique.
// Le rendu interactif (sélecteurs, génération, notes) est dans OneOnOnePrep.
// ============================================================================

import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { SectionHeading } from "@/components/dashboard/section-heading";
import {
  OneOnOnePrep,
  type Member,
} from "@/components/dashboard/one-on-one-prep";
import {
  getRepSessions,
  PERIODS,
  type PeriodType,
} from "@/lib/coaching/one-on-one";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PERIOD_IDS = new Set(PERIODS.map((p) => p.id));

export default async function OneOnOnesPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string; period?: string }>;
}) {
  const { rep, period } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  // Gating : réservé owner/manager (la nav le masque déjà, ceinture-bretelles ici).
  if (
    !profile?.organization_id ||
    (profile.role !== "owner" && profile.role !== "manager")
  ) {
    redirect("/dashboard");
  }
  const orgId = profile.organization_id;

  // Membres de l'org → sélecteur de commercial (on liste tout le monde, le
  // manager choisit ; le badge de rôle aide à distinguer).
  const { data: membersRaw } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("organization_id", orgId)
    .order("full_name", { ascending: true });

  const members: Member[] = (membersRaw ?? []).map((m) => ({
    id: m.id,
    name: (m.full_name || "").trim() || m.email,
    role: m.role,
  }));

  // Période choisie (défaut : ce mois) et commercial sélectionné.
  const selectedPeriod: PeriodType =
    period && PERIOD_IDS.has(period as PeriodType)
      ? (period as PeriodType)
      : "month";
  const selectedRep =
    rep && members.some((m) => m.id === rep) ? rep : null;

  // Historique du commercial sélectionné (le plus récent en tête).
  const sessions = selectedRep ? await getRepSessions(orgId, selectedRep) : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <SectionHeading
        icon={CalendarClock}
        title="Préparer un 1:1"
        description="Un briefing prêt en quelques secondes, pour un échange utile et motivant — sans réécouter un seul appel."
      />

      <OneOnOnePrep
        key={selectedRep ?? "none"}
        members={members}
        periods={PERIODS}
        selectedRep={selectedRep}
        selectedPeriod={selectedPeriod}
        sessions={sessions}
      />
    </div>
  );
}
