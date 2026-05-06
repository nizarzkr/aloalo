import Link from "next/link";
import { ArrowLeft, PhoneOff } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Activé quand notFound() est appelé dans calls/[id]/page.tsx, soit parce
// que l'appel n'existe pas, soit parce qu'il appartient à une autre org.
// Réponse HTTP 404 (sémantiquement correct, vs un redirect qui masquait l'URL).
export default function CallNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 md:px-10">
      <Card className="p-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <PhoneOff className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">Appel introuvable</CardTitle>
              <CardDescription>
                Cet appel n&apos;existe pas, a été supprimé, ou n&apos;appartient
                pas à votre organisation.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/calls"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ArrowLeft className="size-4" />
            Retour à la liste des appels
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
