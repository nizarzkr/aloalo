// ============================================================================
// lib/crypto/org-secrets.ts — chiffrement au repos des credentials tiers
// ============================================================================
// SERVER-ONLY. Ne JAMAIS importer ce module depuis un composant `"use client"` :
// il lit la clé secrète `ORG_SECRETS_ENC_KEY` et utilise `node:crypto`. (On ne
// dépend pas du package `server-only` — non installé ici —, mais `node:crypto`
// n'est de toute façon pas bundlable côté navigateur : un import client casserait
// le build, ce qui sert de garde-fou.)
//
// Pourquoi AES-256-GCM côté Node plutôt que pgcrypto : la clé ne transite jamais
// dans une requête SQL (donc jamais dans les logs Postgres), et GCM authentifie
// le chiffré (détection d'altération).
//
// Format stocké en base : `enc:v1:` + base64( iv(12) || authTag(16) || ciphertext ).
// Le préfixe versionné permet (1) de distinguer un secret chiffré d'un ancien
// secret en clair (migration tolérante), (2) de faire évoluer l'algo plus tard.
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96 bits, recommandé pour GCM
const TAG_LEN = 16; // 128 bits

// Charge la clé à la demande (pas au chargement du module) pour ne pas faire
// planter l'import si la variable d'env n'est pas encore configurée.
function loadKey(): Buffer {
  const raw = process.env.ORG_SECRETS_ENC_KEY;
  if (!raw) {
    throw new Error(
      "ORG_SECRETS_ENC_KEY manquante : impossible de (dé)chiffrer un secret d'organisation.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ORG_SECRETS_ENC_KEY invalide : 32 octets (base64) attendus pour AES-256.",
    );
  }
  return key;
}

// Chiffre un secret en clair. Renvoie toujours une valeur préfixée `enc:v1:`.
// Throw si la clé est absente : on préfère échouer l'écriture plutôt que de
// stocker un secret en clair par accident.
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

// Déchiffre une valeur lue en base. Tolérant à l'ancien format en clair :
//   - null / vide            → null
//   - sans préfixe `enc:v1:` → renvoyé tel quel (legacy clair, rien ne casse)
//   - sinon                  → déchiffré (throw si clé absente ou chiffré altéré)
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value; // ancien secret en clair

  const key = loadKey();
  const buf = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

// Indique si une valeur stockée représente un secret présent (chiffré OU clair),
// sans la déchiffrer. Utilisé pour les badges « Connecté / À configurer ».
export function hasSecret(value: string | null | undefined): boolean {
  return Boolean(value && value.length > 0);
}
