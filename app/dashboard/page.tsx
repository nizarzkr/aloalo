import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const kpis = [
  { label: "Appels cette semaine", value: "—" },
  { label: "Score moyen", value: "—" },
  { label: "Durée totale", value: "—" },
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const fullName = profile?.full_name ?? "";
  const firstName = fullName.trim().split(/\s+/)[0] || "";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {firstName ? `Bienvenue, ${firstName}` : "Bienvenue"}
        </h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {kpis.map(({ label, value }) => (
          <Card key={label} className="p-2">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl font-bold tracking-tight">
                {value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <Card className="p-2">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Aucun appel pour l&apos;instant. Connectez votre téléphonie pour
              commencer à analyser vos performances.
            </p>
            <Link
              href="/dashboard/settings"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              <Settings className="size-4" />
              Aller dans Paramètres
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
