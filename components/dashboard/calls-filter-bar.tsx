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

const SCORE_OPTIONS = [
  { value: "all", label: "Tous les scores" },
  { value: "good", label: "Bons (≥ 70)" },
  { value: "low", label: "À retravailler (< 50)" },
] as const;

const PERIOD_LABEL: Record<string, string> = Object.fromEntries(
  PERIOD_OPTIONS.map((o) => [o.value, o.label]),
);
const SCORE_LABEL: Record<string, string> = Object.fromEntries(
  SCORE_OPTIONS.map((o) => [o.value, o.label]),
);

export function CallsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get("period") ?? "all";
  const currentScore = searchParams.get("score") ?? "all";

  // Met à jour un paramètre, supprime "all" pour garder l'URL propre,
  // et reset systématiquement la pagination à la première page.
  function update(key: "period" | "score", value: string) {
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
        <SelectTrigger className="min-w-44">
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
        value={currentScore}
        onValueChange={(value) => update("score", value as string)}
      >
        <SelectTrigger className="min-w-44">
          <SelectValue>
            {(v: string | null) => SCORE_LABEL[v ?? "all"] ?? "Tous les scores"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SCORE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
