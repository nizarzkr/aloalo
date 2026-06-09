// ============================================================================
// scripts/encrypt-org-secrets.mjs — backfill one-shot (issue #5)
// ============================================================================
// Chiffre EN PLACE les credentials tiers déjà stockés en clair dans
// public.organizations (ringover_api_key, hubspot_token), au format `enc:v1:`
// attendu par lib/crypto/org-secrets.ts.
//
// Idempotent : toute valeur déjà préfixée `enc:v1:` est ignorée. On peut donc
// relancer le script sans risque.
//
// Lancer (Node 20+, lit la clé + les accès Supabase depuis .env.local) :
//   node --env-file=.env.local scripts/encrypt-org-secrets.mjs
//
// La logique AES-256-GCM est volontairement dupliquée ici (≈15 lignes) pour
// éviter la friction d'import d'un module TS depuis un script ESM. Elle DOIT
// rester identique au helper (même algo, même IV/tag/préfixe).
// ============================================================================

import { createCipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function loadKey() {
  const raw = process.env.ORG_SECRETS_ENC_KEY;
  if (!raw) throw new Error("ORG_SECRETS_ENC_KEY manquante.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ORG_SECRETS_ENC_KEY : 32 octets base64 attendus.");
  return key;
}

function encryptSecret(plaintext, key) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY manquantes.");

  const key = loadKey();
  const admin = createClient(url, secret, { auth: { persistSession: false } });

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, ringover_api_key, hubspot_token");
  if (error) throw error;

  let updated = 0;
  for (const org of orgs ?? []) {
    const patch = {};
    for (const col of ["ringover_api_key", "hubspot_token"]) {
      const val = org[col];
      if (val && !val.startsWith(PREFIX)) patch[col] = encryptSecret(val, key);
    }
    if (Object.keys(patch).length === 0) continue;

    const { error: upErr } = await admin
      .from("organizations")
      .update(patch)
      .eq("id", org.id);
    if (upErr) throw upErr;
    updated += 1;
    // On logge l'id et les colonnes touchées, JAMAIS les valeurs.
    console.log(`org ${org.id} : chiffré [${Object.keys(patch).join(", ")}]`);
  }

  console.log(`Terminé. ${updated} organisation(s) mise(s) à jour.`);
}

main().catch((e) => {
  console.error("Échec du backfill :", e.message);
  process.exit(1);
});
