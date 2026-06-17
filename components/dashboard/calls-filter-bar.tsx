"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIOD_OPTIONS = [
  { value: "all", label: "Toute période" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
] as const;

// Filtre qualité (J25) : basé sur les dimensions (validé/partiel/manqué), plus
// sur un score. « À retravailler » = au moins une dimension manquée.
const QUALITY_OPTIONS = [
  { value: "all", label: "Toutes qualités" },
  { value: "solide", label: "Solides" },
  { value: "attention", label: "À retravailler" },
] as const;

const PERIOD_LABEL: Record<string, string> = Object.fromEntries(
  PERIOD_OPTIONS.map((o) => [o.value, o.label]),
);
const QUALITY_LABEL: Record<string, string> = Object.fromEntries(
  QUALITY_OPTIONS.map((o) => [o.value, o.label]),
);

export function CallsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get("period") ?? "all";
  const currentQuality = searchParams.get("quality") ?? "all";

  // Met à jour un paramètre, supprime "all" pour garder l'URL propre,
  // et reset systématiquement la pagination à la première page.
  function update(key: "period" | "quality", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/dashboard/calls?${qs}` : "/dashboard/calls");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={currentPeriod}
        onValueChange={(value) => update("period", value as string)}
      >
        <SelectTrigger className="w-full sm:w-auto sm:min-w-44">
          <SelectValue>
            {(v: string | null) => PERIOD_LABEL[v ?? "all"] ?? "Toute période"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentQuality}
        onValueChange={(value) => update("quality", value as string)}
      >
        <SelectTrigger className="w-full sm:w-auto sm:min-w-44">
          <SelectValue>
            {(v: string | null) =>
              QUALITY_LABEL[v ?? "all"] ?? "Toutes qualités"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {QUALITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
