// ============================================================================
// /dashboard/settings/account — Compte + Organisation
// ============================================================================

import { redirect } from "next/navigation";
import { Building2, UserRound } from "lucide-react";

import { OrgSettingsForm } from "@/components/dashboard/org-settings-form";
import { SectionHeading } from "@/components/dashboard/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", user.id)
      .single(),
    supabase.from("organizations").select("name, logo_url").maybeSingle(),
  ]);

  const isOwner = profile?.role === "owner";

  return (
    <div className="space-y-12">
      {/* Compte */}
      <section>
        <SectionHeading
          icon={UserRound}
          title="Compte"
          description="Vos informations personnelles."
        />
        <Card>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-[120px_1fr]">
              <dt className="text-muted-foreground">Nom</dt>
              <dd className="font-medium text-foreground">
                {profile?.full_name ?? "—"}
              </dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground">
                {profile?.email ?? user.email}
              </dd>
              <dt className="text-muted-foreground">Rôle</dt>
              <dd className="font-medium text-foreground capitalize">
                {profile?.role ?? "—"}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* Organisation */}
      <section>
        <SectionHeading
          icon={Building2}
          title="Organisation"
          description="Nom et logo affichés dans Aloalo."
        />
        <Card>
          <CardContent>
            {org ? (
              <OrgSettingsForm
                defaultName={org.name ?? ""}
                defaultLogoUrl={org.logo_url ?? ""}
                canEdit={isOwner}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Impossible de charger votre organisation.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
