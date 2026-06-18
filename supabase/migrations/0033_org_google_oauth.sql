-- ============================================================================
-- Aloalo — Migration 0033 : jetons OAuth Google (Meet) par organisation
-- Date  : 2026-06-18
-- J-day : J42 (Semaine 5+) — Intégration Google Meet (connexion + transcripts)
-- ============================================================================
-- Contexte : on branche Google Meet comme source d'enregistrement (abstraction
-- J41). L'org connecte son compte Google Workspace en OAuth ; on lit ensuite les
-- TRANSCRIPTIONS natives de Meet via la Meet REST API (pas d'AssemblyAI, pas de
-- téléchargement vidéo Drive — décision Nizar 18/06 : Google transcrit déjà,
-- avec les vrais noms des participants, gratuitement). Google renvoie un
-- access_token court (~1h) + un refresh_token (obtenu UNIQUEMENT à la 1re
-- autorisation avec access_type=offline&prompt=consent) que notre serveur
-- renouvelle tout seul (cf. lib/google-oauth.ts).
--
-- Même modèle que les jetons HubSpot (migration 0032) :
--   access_token / refresh_token sont des SECRETS → chiffrés au repos au format
--   `enc:v1:` (AES-256-GCM, lib/crypto/org-secrets.ts). expires_at = horodatage
--   (pas un secret). google_email = compte connecté (affiché « Connecté en tant
--   que … »), non secret.
--
-- ⚠️ Différence Google vs HubSpot : le grant `refresh_token` NE renvoie PAS de
--   nouveau refresh_token → storeTokens conserve l'ancien si absent de la réponse.
--
-- Aucune policy à ajouter : ces colonnes héritent du RLS de `organizations` et ne
-- sont jamais SELECTées côté client RLS (uniquement via le service key, issue #5).
-- `add column if not exists` → migration idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists google_access_token  text,
  add column if not exists google_refresh_token text,
  add column if not exists google_token_expires_at timestamptz,
  add column if not exists google_email text;

comment on column public.organizations.google_access_token is
  'Jeton d''accès OAuth Google (court, ~1h), chiffré enc:v1: (issue #5). Rafraîchi automatiquement par getGoogleToken() (lib/google-oauth.ts). NULL = org non connectée à Google.';

comment on column public.organizations.google_refresh_token is
  'Jeton de rafraîchissement OAuth Google (longue durée), chiffré enc:v1:. Obtenu seulement à la 1re autorisation (access_type=offline&prompt=consent). SECRET — jamais exposé au client. Conservé tel quel lors d''un refresh (Google ne le renvoie pas à chaque fois).';

comment on column public.organizations.google_token_expires_at is
  'Échéance de google_access_token (now + expires_in - marge). getGoogleToken() rafraîchit dès que dépassée. NULL si pas de jeton Google.';

comment on column public.organizations.google_email is
  'Adresse Google du compte connecté (affichage « Connecté en tant que … »). Non secret. NULL si non connecté.';
