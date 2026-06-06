"use client";

// ============================================================================
// TeamView — Membres + invitations pending + dialog d'invitation (J8 étape 4)
// ============================================================================
// Mapping rôles : on suit la convention projet (owner/manager/sales) — le brief
// parlait de admin/member, mais le schéma est figé sur owner/manager/sales.
// Couleurs badges : owner=violet, manager=bleu, sales=gris.
// ============================================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, Users, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
};

type Props = {
  members: Member[];
  pending: PendingInvitation[];
  isOwner: boolean;
  currentUserId: string;
  // Slot server-rendered (cf. team-leaderboard.tsx) inséré au-dessus de la
  // liste des membres. Passé en ReactNode pour pouvoir mélanger composant
  // serveur et client sans hisser tout le calcul ici.
  leaderboard?: ReactNode;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  sales: "Commercial·e",
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  sales: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
};

function roleLabel(role: string) {
  return ROLE_LABEL[role] ?? role;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-0", ROLE_BADGE[role] ?? ROLE_BADGE.sales)}
    >
      {roleLabel(role)}
    </Badge>
  );
}

type Toast = { message: string; kind: "success" | "error" } | null;

export function TeamView({
  members: initialMembers,
  pending: initialPending,
  isOwner,
  currentUserId,
  leaderboard,
}: Props) {
  const router = useRouter();
  // État local : on retire les lignes de la liste après une action réussie
  // sans avoir à refetch toute la page.
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [pending, setPending] = useState<PendingInvitation[]>(initialPending);
  const [toast, setToast] = useState<Toast>(null);

  // Resync du state local quand les props serveur changent (après router.refresh()).
  // Sans ça, un `useState(prop)` reste figé sur sa valeur initiale et la table
  // "Invitations en attente" ne se rafraîchit jamais.
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    setPending(initialPending);
  }, [initialPending]);

  useEffect(() => {
    if (!toast) return;
    // 6s pour laisser le temps de lire (avant: 3.5s, trop court selon les
    // retours du smoke test J13).
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleInvited = (email: string) => {
    setToast({ message: `Invitation envoyée à ${email}`, kind: "success" });
    // Retardé pour laisser le toast s'afficher avant un éventuel re-mount
    // déclenché par le refetch du Server Component parent.
    setTimeout(() => router.refresh(), 1500);
  };

  async function handleCancelInvitation(inv: PendingInvitation) {
    if (!window.confirm(`Annuler l'invitation envoyée à ${inv.email} ?`)) {
      return;
    }
    const res = await fetch(`/api/invitations/${inv.id}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setToast({
        message: `Échec de l'annulation : ${payload?.error ?? "erreur"}`,
        kind: "error",
      });
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== inv.id));
    setToast({
      message: `Invitation annulée pour ${inv.email}`,
      kind: "success",
    });
  }

  async function handleRemoveMember(member: Member) {
    const displayName = member.full_name?.trim() || member.email;
    if (
      !window.confirm(
        `Retirer ${displayName} de l'équipe ? Il perdra l'accès au dashboard.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/team/members/${member.id}`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setToast({
        message: `Échec du retrait : ${payload?.error ?? "erreur"}`,
        kind: "error",
      });
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    setToast({
      message: `${displayName} a été retiré de l'équipe`,
      kind: "success",
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les membres de votre organisation et leurs invitations.
          </p>
        </div>
        {isOwner ? <InviteMemberDialog onInvited={handleInvited} /> : null}
      </header>

      {leaderboard}

      <MembersSection
        members={members}
        currentUserId={currentUserId}
        isOwner={isOwner}
        onRemove={handleRemoveMember}
        // Solo owner sans invitation en attente = équipe vide en pratique.
        // L'action invite est rendue via le même dialog que dans le header,
        // avec sa propre instance d'état.
        isPracticallyEmpty={
          members.length === 0 ||
          (members.length === 1 &&
            members[0].id === currentUserId &&
            pending.length === 0)
        }
        emptyAction={
          isOwner ? <InviteMemberDialog onInvited={handleInvited} /> : null
        }
      />

      {pending.length > 0 ? (
        <PendingSection
          pending={pending}
          isOwner={isOwner}
          onCancel={handleCancelInvitation}
        />
      ) : null}

      {toast ? (
        <div
          role={toast.kind === "error" ? "alert" : "status"}
          aria-live={toast.kind === "error" ? "assertive" : "polite"}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-lg border bg-background px-4 py-3 text-sm shadow-lg",
            toast.kind === "success"
              ? "border-emerald-500/30"
              : "border-destructive/40",
          )}
        >
          <div
            aria-hidden
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
              toast.kind === "success"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {toast.kind === "success" ? (
              <Check className="size-3.5" />
            ) : (
              <span className="text-xs font-bold">!</span>
            )}
          </div>
          <span className="leading-snug">{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Section 1 — Membres actifs
// ----------------------------------------------------------------------------
function MembersSection({
  members,
  currentUserId,
  isOwner,
  onRemove,
  isPracticallyEmpty,
  emptyAction,
}: {
  members: Member[];
  currentUserId: string;
  isOwner: boolean;
  onRemove: (member: Member) => void | Promise<void>;
  isPracticallyEmpty: boolean;
  emptyAction: ReactNode;
}) {
  // Un owner ne peut pas se retirer lui-même → on cache le bouton dans ce cas.
  const canRemove = (m: Member) => isOwner && m.id !== currentUserId;

  if (isPracticallyEmpty) {
    return (
      <section>
        <Card className="p-2">
          <CardContent>
            <EmptyState
              icon={Users}
              title="Votre équipe est vide"
              description="Invitez vos commerciaux et managers pour analyser leurs appels et suivre leur progression."
              action={emptyAction}
            />
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <Card className="p-2">
        <CardHeader>
          <CardTitle>Membres ({members.length})</CardTitle>
          <CardDescription>
            Tous les utilisateurs ayant accès à votre organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {/* Mobile : cards empilées */}
          <ul className="flex flex-col gap-2 px-4 sm:hidden">
            {members.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/dashboard/users/${m.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {m.full_name?.trim() || m.email}
                    {m.id === currentUserId ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (vous)
                      </span>
                    ) : null}
                  </Link>
                  <RoleBadge role={m.role} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {m.email}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Membre depuis le {formatDate(m.created_at)}
                  </p>
                  {canRemove(m) ? (
                    <RemoveMemberButton member={m} onRemove={onRemove} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop : table */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Nom</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Rôle</th>
                  <th className="px-4 py-2 font-medium">Membre depuis</th>
                  {isOwner ? <th className="px-4 py-2"></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/dashboard/users/${m.id}`}
                        className="hover:underline"
                      >
                        {m.full_name?.trim() || "—"}
                      </Link>
                      {m.id === currentUserId ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (vous)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.email}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={m.role} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(m.created_at)}
                    </td>
                    {isOwner ? (
                      <td className="px-4 py-3 text-right">
                        {canRemove(m) ? (
                          <RemoveMemberButton member={m} onRemove={onRemove} />
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function RemoveMemberButton({
  member,
  onRemove,
}: {
  member: Member;
  onRemove: (member: Member) => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await onRemove(member);
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Retrait…" : "Retirer"}
    </Button>
  );
}

// ----------------------------------------------------------------------------
// Section 2 — Invitations pending
// ----------------------------------------------------------------------------
function PendingSection({
  pending,
  isOwner,
  onCancel,
}: {
  pending: PendingInvitation[];
  isOwner: boolean;
  onCancel: (inv: PendingInvitation) => void | Promise<void>;
}) {
  return (
    <section className="mt-8">
      <Card className="p-2">
        <CardHeader>
          <CardTitle>Invitations en attente ({pending.length})</CardTitle>
          <CardDescription>
            Les invitations expirent 7 jours après leur envoi.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y divide-border">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expire le {formatDate(inv.expires_at)}
                  </p>
                </div>
                <RoleBadge role={inv.role} />
                {isOwner ? (
                  <CancelInvitationButton invitation={inv} onCancel={onCancel} />
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function CancelInvitationButton({
  invitation,
  onCancel,
}: {
  invitation: PendingInvitation;
  onCancel: (inv: PendingInvitation) => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await onCancel(invitation);
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Annulation…" : "Annuler"}
    </Button>
  );
}

// ----------------------------------------------------------------------------
// Section 3 — Dialog d'invitation
// ----------------------------------------------------------------------------
function InviteMemberDialog({
  onInvited,
}: {
  onInvited: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "sales">("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEmail("");
    setRole("sales");
    setError(null);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        const errorMsg = payload?.error ?? "unknown_error";
        setError(humanizeError(errorMsg));
        setLoading(false);
        return;
      }
      onInvited(email.trim().toLowerCase());
      reset();
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError("Une erreur réseau est survenue.");
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="size-4" />
            Inviter un membre
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un membre</DialogTitle>
          <DialogDescription>
            Un email sera envoyé avec un lien valable 7 jours.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">Rôle</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "manager" | "sales")}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Commercial·e</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
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
            {loading ? "Envoi…" : "Envoyer l'invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function humanizeError(code: string): string {
  switch (code) {
    case "already_member":
      return "Cette personne fait déjà partie de votre équipe.";
    case "already_invited":
      return "Une invitation est déjà en attente pour cette adresse.";
    case "forbidden":
      return "Vous n'êtes pas autorisé à inviter (owner uniquement).";
    case "invalid_body":
    case "invalid_json":
      return "Email ou rôle invalide.";
    case "unauthorized":
      return "Session expirée, reconnectez-vous.";
    default:
      return "Échec de l'envoi de l'invitation.";
  }
}
