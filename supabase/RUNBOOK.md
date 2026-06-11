# Supabase — Runbook sauvegarde / restauration / migrations

Procédures opérationnelles pour la base de production (projet `kynqancfanvekodbhukd`,
région West EU / Paris). La base contient des **données tenant sensibles**
(transcriptions et analyses d'appels) : aucun dump ne doit être committé ni stocké chez
Supabase.

---

## 1. Sauvegardes (backups)

### PITR — Point-In-Time Recovery (recommandé)

Activer **PITR** dans le dashboard Supabase :
**Project Settings → Database → Backups**, pour le projet `kynqancfanvekodbhukd`.
Permet ensuite de restaurer la base à un **instant précis** (pas seulement un snapshot
quotidien) — c'est le filet principal en cas de mauvaise migration ou de suppression
accidentelle.

### Dump manuel / portable

Pour une copie portable (migration de projet, archive froide), faire un dump avec
`pg_dump` (ou `supabase db dump`) contre la connection string de
**Project Settings → Database** :

```bash
# format custom (-Fc), compressé et restaurable sélectivement avec pg_restore
pg_dump "$SUPABASE_DB_URL" -Fc -f aloalo-$(date +%F).dump
# équivalent CLI Supabase :
# supabase db dump --db-url "$SUPABASE_DB_URL" -f aloalo-$(date +%F).dump
```

> ⚠️ Le dump contient des données tenant : le stocker **hors Supabase** (stockage chiffré
> dédié) et **ne JAMAIS le committer** dans le repo.

---

## 2. Restauration (restore)

### Depuis PITR

Dashboard → **Database → Backups → restore-to-timestamp** : choisir l'instant cible
(typiquement juste avant l'incident).

### Depuis un dump

```bash
pg_restore --clean --if-exists -d "$TARGET_DB_URL" aloalo-YYYY-MM-DD.dump
```

(`--clean --if-exists` supprime les objets existants avant de les recréer, sans erreur si
absents.)

---

## 3. Migrations — recover / replay / rollback

Les migrations sont les fichiers numérotés de `supabase/migrations/`
(`0001` → `0022` aujourd'hui), **appliqués dans l'ordre numérique**. Elles sont
l'**unique source de vérité** du schéma : pour reconstruire une base vierge à
l'identique, les rejouer dans l'ordre.

### Prochain numéro de migration

Le prochain numéro libre = fichier existant le plus haut + 1.
**Aujourd'hui : 0022 → prochain = `0023`** (`supabase/migrations/0023_description.sql`).

### Rollback d'une mauvaise migration

Il n'y a **pas** de convention de migration `down`/rollback. Deux chemins de récupération :

1. **PITR** : restaurer la base juste **avant** que la migration fautive ne tourne
   (option la plus sûre pour annuler des effets de données).
2. **Migration forward inverse** : écrire une **nouvelle** migration numérotée
   (`supabase/migrations/0023_*.sql`, prochain numéro libre) qui **annule** le changement.

> ⛔ **Ne JAMAIS éditer une migration déjà appliquée.** Toujours ajouter un nouveau
> fichier numéroté — éditer un fichier appliqué crée une dérive entre la prod et l'arbre
> de migrations (la base reconstruite depuis les fichiers ne correspondrait plus).

### Invariants à revérifier après toute restauration

Après un restore (PITR ou dump), confirmer que les garde-fous de sécurité sont en place
(cf. `AGENTS.md` « Sécurité ») :

- **RLS activée sur toutes les tables `public.*`** (et FORCE RLS, cf. `0022`).
- Le helper RLS **`public.user_organization_id()`** (SECURITY DEFINER) existe.
- Le trigger **`on_auth_user_created`** (fonction `public.handle_new_user`) existe — sans
  lui, aucun signup ne crée d'org + profile owner.
