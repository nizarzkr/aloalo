// ============================================================================
// Layout du site vitrine (route group `(marketing)`)
// ============================================================================
// Le groupe entre parenthèses n'apparaît PAS dans l'URL : `/`, `/privacy`,
// `/terms` et `/legal` gardent exactement les mêmes adresses qu'avant, mais
// héritent désormais de la nav pill et du footer.
//
// Le dashboard, l'auth et l'onboarding restent hors du groupe : ils ont leur
// propre chrome et ne doivent pas hériter d'ici.
// ============================================================================

import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
