"use client";

// ============================================================================
// JoinForm — UI d'acceptation d'invitation (J8 étape 3)
// ============================================================================
// Trois cas :
//  A. Visiteur non connecté → mini formulaire signup (email pré-rempli)
//  B. Visiteur connecté avec le bon email → bouton "Rejoindre"
//  C. Visiteur connecté avec un autre email → "Déconnectez-vous d'abord"
// ============================================================================

import { useState, type FormEvent } from "react";

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
import { createClient } from "@/lib/supabase/client";

type Props = {
  token: string;
  email: string;
  orgName: string;
  role: string;
  isLoggedIn: boolean;
  currentUserEmail?: string;
};

const ROLE_LABEL: Record<string, string> = {
  manager: "manager",
  sales: "commercial·e",
  owner: "owner",
};

function roleFr(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

// Recharge le navigateur sur /dashboard. On évite router.push qui garderait
// le cache RSC obsolète (le profile vient de changer d'org).
function goToDashboard() {
  window.location.assign("/dashboard");
}

export function JoinForm(props: Props) {
  const { token, email, orgName, role, isLoggedIn, currentUserEmail } = props;

  // Cas C — connecté avec le mauvais email
  const wrongAccount =
    isLoggedIn &&
    currentUserEmail &&
    currentUserEmail.toLowerCase() !== email.toLowerCase();

  if (wrongAccount) {
    return <WrongAccountCard invitedEmail={email} />;
  }

  // Cas B — connecté avec le bon email
  if (isLoggedIn) {
    return <AcceptOnlyCard token={token} orgName={orgName} role={role} />;
  }

  // Cas A — non connecté
  return (
    <SignupAndAcceptCard
      token={token}
      email={email}
      orgName={orgName}
      role={role}
    />
  );
}

// ----------------------------------------------------------------------------
// Cas A
// ----------------------------------------------------------------------------
function SignupAndAcceptCard({
  token,
  email,
  orgName,
  role,
}: {
  token: string;
  email: string;
  orgName: string;
  role: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    try {
      const supabase = createClient();

      // 1. Signup — le trigger SQL va créer une org parasite, supprimée plus
      //    tard par le endpoint accept.
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            // Org temporaire ; sera supprimée par /accept si elle reste vide.
            organization_name: `${firstName || email}'s workspace`,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // 2. Acceptation de l'invitation
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(
          payload?.error
            ? `Échec de l'acceptation : ${payload.error}`
            : "Échec de l'acceptation de l'invitation.",
        );
        setLoading(false);
        return;
      }

      goToDashboard();
    } catch (err) {
      console.error(err);
      setError("Une erreur inattendue est survenue.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vous êtes invité à rejoindre {orgName}</CardTitle>
        <CardDescription>
          Créez votre compte pour rejoindre l&apos;équipe en tant que {roleFr(role)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="first_name">Prénom</Label>
              <Input
                id="first_name"
                name="first_name"
                type="text"
                autoComplete="given-name"
                required
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="last_name">Nom</Label>
              <Input
                id="last_name"
                name="last_name"
                type="text"
                autoComplete="family-name"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              readOnly
              className="bg-muted"
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
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={loading}>
            {loading ? "Création du compte…" : "Créer mon compte et rejoindre"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Cas B
// ----------------------------------------------------------------------------
function AcceptOnlyCard({
  token,
  orgName,
  role,
}: {
  token: string;
  orgName: string;
  role: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(
          payload?.error
            ? `Échec de l'acceptation : ${payload.error}`
            : "Échec de l'acceptation de l'invitation.",
        );
        setLoading(false);
        return;
      }
      goToDashboard();
    } catch (err) {
      console.error(err);
      setError("Une erreur inattendue est survenue.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rejoindre {orgName}</CardTitle>
        <CardDescription>
          Vous êtes sur le point de rejoindre l&apos;équipe en tant que{" "}
          {roleFr(role)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}
        <Button onClick={handleAccept} disabled={loading}>
          {loading ? "Acceptation…" : "Rejoindre"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Cas C
// ----------------------------------------------------------------------------
function WrongAccountCard({ invitedEmail }: { invitedEmail: string }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // Recharge la même page : le serveur va re-render en cas A.
      window.location.reload();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mauvais compte</CardTitle>
        <CardDescription>
          Ce lien d&apos;invitation est destiné à <strong>{invitedEmail}</strong>.
          Vous êtes connecté avec un autre compte. Déconnectez-vous d&apos;abord
          pour accepter l&apos;invitation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleLogout} disabled={loading} className="w-full">
          {loading ? "Déconnexion…" : "Se déconnecter"}
        </Button>
      </CardContent>
    </Card>
  );
}
