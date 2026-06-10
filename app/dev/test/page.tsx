import { notFound } from "next/navigation";
import { isSimulatorEnabled } from "@/lib/dev/is-simulator-enabled";
import { DevTestClient } from "./dev-test-client";

// Outil DEV : 404 en production pour ne pas l'exposer aux vrais clients.
export default function DevTestPage() {
  if (!isSimulatorEnabled()) notFound();
  return <DevTestClient />;
}
