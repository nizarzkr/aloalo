import Link from "next/link";
import { Mail } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Page d'attente affichée juste après le signup quand "Confirm email" est ON
// dans Supabase. L'utilisateur ne peut rien faire ici à part attendre le mail
// et cliquer son lien — qui le ramènera authentifié via /auth/callback.
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Card className="p-2">
      <CardHeader className="space-y-4">
        <div
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Mail className="size-6" />
        </div>
        <div>
          <CardTitle className="text-xl">Vérifiez votre boîte mail</CardTitle>
          <CardDescription className="mt-1">
            Un email de confirmation vient d&apos;être envoyé
            {email ? (
              <>
                {" "}à <strong className="text-foreground">{email}</strong>
              </>
            ) : null}
            . Cliquez sur le lien à l&apos;intérieur pour activer votre compte
            et accéder à votre tableau de bord.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Pas reçu&nbsp;? Vérifiez votre dossier spam. Le lien expire dans 24 heures.
        </p>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Retour à la connexion
        </Link>
      </CardContent>
    </Card>
  );
}
