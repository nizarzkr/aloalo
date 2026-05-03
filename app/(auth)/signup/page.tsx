import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signup } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">Créer un compte Aloalo</CardTitle>
        <CardDescription>
          14 jours gratuits — sans carte bancaire.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <form action={signup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="full_name">Nom complet</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="organization_name">Nom de l&apos;entreprise</Label>
            <Input
              id="organization_name"
              name="organization_name"
              type="text"
              autoComplete="organization"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email professionnel</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              8 caractères minimum.
            </p>
          </div>

          <Button type="submit" className="mt-2">
            Créer mon compte
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
