// ============================================================================
// Réplique — briefing « Préparer un 1:1 » (/dashboard/one-on-ones)
// ============================================================================
// Reprend la structure réelle du brief manager : instantané de la période,
// ce qui progresse, UN seul axe à travailler (avec une piste concrète), et les
// deals à suivre. Ton volontairement bienveillant, comme dans le produit.
// ============================================================================

import { Lightbulb, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Frame } from "./frame";

const WINS = [
  "Découverte validée sur 4 appels sur 5 (contre 2 sur 5 le mois dernier).",
  "Les questions ouvertes en début d'appel sont devenues systématiques.",
];

export function OneOnOneMockup({ className }: { className?: string }) {
  return (
    <Frame
      label="aloalo.app / préparer un 1:1"
      activeItem="Préparer un 1:1"
      className={className}
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-heading text-base font-medium">
            1:1 — Léa Fabre
          </p>
          <span className="font-mono text-[10px] tracking-[-0.03em] text-muted-foreground">
            30 derniers jours
          </span>
        </div>

        {/* Instantané chiffré */}
        <Card size="sm">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            <span>
              <span className="font-medium">9 appels</span> analysés sur la
              période
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Dimensions validées</span>
              <span className="font-semibold tabular-nums">3,4 / 5</span>
              <Badge className="gap-1 bg-mint text-foreground">
                <TrendingUp className="size-3" />
                +0,8
              </Badge>
            </span>
          </CardContent>
        </Card>

        {/* Ce qui progresse */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-[13px]">🎉 Ce qui progresse</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {WINS.map((win) => (
                <li key={win} className="flex gap-2 text-[12px] leading-relaxed">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-mint" />
                  {win}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Un seul axe de travail — jamais une liste de reproches */}
        <Card size="sm" className="ring-mint/60">
          <CardHeader>
            <CardTitle className="text-[13px]">
              🌱 À travailler ensemble
            </CardTitle>
            <CardDescription className="text-[11px]">
              Verrouiller la prochaine étape
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-[12px] leading-relaxed">
            <p>
              Sur 6 appels sur 9, l&apos;appel se termine sans date convenue.
              Les relances repartent ensuite par email, sans réponse.
            </p>
            <div className="flex gap-2 rounded-md bg-secondary p-2.5">
              <Lightbulb className="size-3.5 shrink-0" />
              <p>
                <span className="font-medium">Piste à tester : </span>
                proposer deux créneaux précis avant de raccrocher, plutôt que
                « je vous recontacte ».
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Ses deals à suivre */}
        <Card size="sm" className="py-0">
          <ul className="divide-y divide-foreground/5">
            <li className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium">
                  Helios — Refonte du parc
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Budget non confirmé depuis 2 appels
                </p>
              </div>
              <Badge className="shrink-0 bg-red-100 text-red-700">
                À prioriser
              </Badge>
            </li>
          </ul>
        </Card>
      </div>
    </Frame>
  );
}
