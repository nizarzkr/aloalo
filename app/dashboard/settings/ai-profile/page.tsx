// ============================================================================
// /dashboard/settings/ai-profile — Profil IA (contexte injecté dans l'analyse)
// ============================================================================

import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { AiProfileForm } from "@/components/dashboard/ai-profile-form";
import { SectionHeading } from "@/components/dashboard/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { AiProfileData } from "@/lib/validations";

export const dynamic = "force-dynamic";

export default async function AiProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("organizations").select("ai_profile").maybeSingle(),
  ]);

  const isOwner = profile?.role === "owner";
  // ai_profile est un jsonb (typé unknown côté TS) : cast prudent, le form
  // supporte les clés manquantes.
  const aiProfile =
    (org?.ai_profile as Partial<AiProfileData> | null | undefined) ?? null;

  return (
    <div>
      <SectionHeading
        icon={Sparkles}
        title="Profil IA"
        description="Ce contexte est injecté dans l'analyse IA de chaque appel. Plus il est précis, plus le coaching généré est pertinent pour votre équipe."
      />
      <Card>
        <CardContent>
          <AiProfileForm defaultValues={aiProfile} canEdit={isOwner} />
        </CardContent>
      </Card>
    </div>
  );
}
