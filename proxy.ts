import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // On exclut /api (et les webhooks) : ces routes ne dépendent jamais des
    // redirections du proxy, et le getUser() bloquant ralentirait inutilement
    // les webhooks fournisseurs (Stripe, AssemblyAI, Ringover) au timeout serré.
    // On exclut aussi les assets statiques (_next/static, _next/image, favicon).
    // L'auth du dashboard est de toute façon re-vérifiée côté serveur.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
