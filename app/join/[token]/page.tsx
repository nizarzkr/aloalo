// ============================================================================
// /join/[token] — page d'acceptation d'invitation (J8 étape 3)
// ============================================================================
// Server Component : on valide le token côté serveur via le client admin
// (RLS bypass — c'est une route publique) puis on délègue l'UI au form client.
// ============================================================================

import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { JoinForm } from "@/components/join/join-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

type InvalidReason = "expired" | "already_used" | "not_found" | "fetch_error";

const ERROR_MESSAGES: Record<InvalidReason, { title: string; body: string }> = {
  expired: {
    title: "Lien expiré",
    body: "Ce lien d'invitation a plus de 7 jours. Demandez à votre manager de vous renvoyer une invitation.",
  },
  already_used: {
    title: "Lien déjà utilisé",
    body: "Cette invitation a déjà été acceptée. Connectez-vous avec le compte que vous avez créé.",
  },
  not_found: {
    title: "Lien invalide",
    body: "Ce lien d'invitation n'existe pas. Vérifiez l'URL ou demandez un nouveau lien à votre manager.",
  },
  fetch_error: {
    title: "Une erreur est survenue",
    body: "Impossible de vérifier l'invitation. Réessayez dans quelques instants.",
  },
};

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = getAdminClient();
  const { data: invitation, error } = await admin
    .from("invitations")
    .select(
      "id, email, role, accepted_at, expires_at, organization_id, organizations(name)",
    )
    .eq("token", token)
    .maybeSingle<{
      id: string;
      email: string;
      role: string;
      accepted_at: string | null;
      expires_at: string;
      organization_id: string;
      organizations: { name: string } | { name: string }[] | null;
    }>();

  let invalidReason: InvalidReason | null = null;
  if (error) {
    console.error("invitation lookup failed", error);
    invalidReason = "fetch_error";
  } else if (!invitation) {
    invalidReason = "not_found";
  } else if (invitation.accepted_at) {
    invalidReason = "already_used";
  } else {
    // Server Component → un seul rendu par requête, l'horodatage est stable.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (new Date(invitation.expires_at).getTime() <= now) {
      invalidReason = "expired";
    }
  }

  if (invalidReason || !invitation) {
    const msg = ERROR_MESSAGES[invalidReason ?? "not_found"];
    return (
      <Card>
        <CardHeader>
          <CardTitle>{msg.title}</CardTitle>
          <CardDescription>{msg.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className={buttonVariants({ variant: "default" }) + " w-full"}
          >
            Aller à la connexion
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Normalisation de la jointure (objet ou tableau selon la version client).
  const orgRel = invitation.organizations;
  const orgName = Array.isArray(orgRel)
    ? orgRel[0]?.name ?? ""
    : orgRel?.name ?? "";

  // Session du visiteur — détermine le cas A / B / C dans le form.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <JoinForm
      token={token}
      email={invitation.email}
      orgName={orgName}
      role={invitation.role}
      isLoggedIn={Boolean(user)}
      currentUserEmail={user?.email ?? undefined}
    />
  );
}
