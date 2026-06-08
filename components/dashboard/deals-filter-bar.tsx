"use client";

// ============================================================================
// DealsFilterBar (J24bis) — recherche + risque + commercial + tri
// ============================================================================
// Tous les filtres passent par l'URL (comme CallsFilterBar) → server-rendered,
// rechargeable, partageable. La recherche texte est débouncée pour ne pas
// repousser l'URL à chaque frappe.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RISK_OPTIONS = [
  { value: "all", label: "Tous les deals" },
  { value: "risk", label: "À risque seulement" },
] as const;

const SORT_OPTIONS = [
  { value: "risk", label: "Tri : risque d'abord" },
  { value: "recent", label: "Tri : activité récente" },
] as const;

const RISK_LABEL: Record<string, string> = Object.fromEntries(
  RISK_OPTIONS.map((o) => [o.value, o.label]),
);
const SORT_LABEL: Record<string, string> = Object.fromEntries(
  SORT_OPTIONS.map((o) => [o.value, o.label]),
);

export type OwnerOption = { id: string; name: string };

export function DealsFilterBar({ owners }: { owners: OwnerOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentRisk = searchParams.get("risk") ?? "all";
  const currentOwner = searchParams.get("owner") ?? "all";
  const currentSort = searchParams.get("sort") ?? "risk";
  const currentQuery = searchParams.get("q") ?? "";

  // État local de la recherche pour un input réactif, synchronisé avec l'URL.
  const [search, setSearch] = useState(currentQuery);
  const firstRender = useRef(true);

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `/dashboard/deals?${qs}` : "/dashboard/deals");
  }

  function update(key: "risk" | "owner" | "sort", value: string) {
    pushParams((params) => {
      // "all" pour risk/owner et "risk" (défaut) pour sort → on nettoie l'URL.
      const isDefault =
        ((key === "risk" || key === "owner") && value === "all") ||
        (key === "sort" && value === "risk");
      if (isDefault) params.delete(key);
      else params.set(key, value);
    });
  }

  // Débounce de la recherche texte (350 ms).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      pushParams((params) => {
        const v = search.trim();
        if (v) params.set("q", v);
        else params.delete("q");
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (contact, entreprise, deal)"
          className="pl-9"
        />
      </div>

      <Select value={currentRisk} onValueChange={(v) => update("risk", v as string)}>
        <SelectTrigger className="w-full sm:w-auto sm:min-w-44">
          <SelectValue>
            {(v: string | null) => RISK_LABEL[v ?? "all"] ?? "Tous les deals"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {RISK_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentOwner} onValueChange={(v) => update("owner", v as string)}>
        <SelectTrigger className="w-full sm:w-auto sm:min-w-44">
          <SelectValue>
            {(v: string | null) =>
              v && v !== "all"
                ? (owners.find((o) => o.id === v)?.name ?? "Commercial")
                : "Tous les commerciaux"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les commerciaux</SelectItem>
          {owners.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentSort} onValueChange={(v) => update("sort", v as string)}>
        <SelectTrigger className="w-full sm:w-auto sm:min-w-44">
          <SelectValue>
            {(v: string | null) => SORT_LABEL[v ?? "risk"] ?? "Tri : risque d'abord"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
