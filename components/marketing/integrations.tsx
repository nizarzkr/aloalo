// ============================================================================
// Section « Intégrations »
// ============================================================================
// Pas de logos tiers : on n'a pas de partenariat officiel avec ces éditeurs et
// afficher leurs marques laisserait entendre le contraire. Des blocs texte,
// sobres, cohérents avec la DA typographique.
// ============================================================================

import { DisplayTitle, Kicker, Panel, Section } from "./section";
import { INTEGRATIONS } from "@/lib/site";

export function Integrations() {
  return (
    <Section id="integrations">
      <Panel>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <Kicker>Intégrations</Kicker>
            <DisplayTitle size="sm" className="mt-4 max-w-sm">
              Vos outils restent les vôtres.
            </DisplayTitle>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Aloalo se branche sur ce que votre équipe utilise déjà et renvoie
              tout dans votre CRM. Rien à migrer, rien à désapprendre, aucun
              lock-in : si vous partez, vos notes et vos tâches sont déjà chez
              vous.
            </p>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Votre téléphonie ou votre CRM n&apos;est pas dans la liste ?
              Dites-le nous — l&apos;architecture est prévue pour en ajouter
              sans tout réécrire.
            </p>
          </div>

          <ul className="grid gap-px self-start overflow-hidden rounded-[24px] bg-foreground/10 sm:grid-cols-2">
            {INTEGRATIONS.map((integration) => (
              <li key={integration.name} className="bg-card p-6">
                <p className="font-mono text-[11px] tracking-[-0.03em] text-muted-foreground uppercase">
                  {integration.kind}
                </p>
                <p className="mt-1.5 font-heading text-2xl font-bold tracking-[-0.02em]">
                  {integration.name}
                </p>
              </li>
            ))}
            <li className="flex items-center bg-card p-6">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Connexion en quelques minutes, par autorisation OAuth — aucun
                fichier à importer.
              </p>
            </li>
          </ul>
        </div>
      </Panel>
    </Section>
  );
}
