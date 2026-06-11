# Supabase — Runbook sauvegarde / restauration / migrations

Procédures opérationnelles pour la base de production (projet `kynqancfanvekodbhukd`,
région West EU / Paris). La base contient des **données tenant sensibles**
(transcriptions et analyses d'appels) : aucun dump ne doit être committé ni stocké chez
Supabase.

---

## 1. Sauvegardes (backups)

> ⚠️ **Plan actuel : Supabase gratuit → AUCUNE sauvegarde automatique ni PITR.**
> Les sauvegardes quotidiennes automatiques et le PITR sont réservés au plan **Pro**
> (PITR étant un add-on payant par-dessus). Tant qu'on reste en gratuit, **le dump
> manuel `pg_dump` ci-dessous est notre SEULE stratégie de sauvegarde** — à faire à la
> main (idéalement avant chaque migration risquée, et de façon périodique).

### Dump manuel / portable (méthode active en plan gratuit)

`pg_dump` (ou `supabase db dump`) fonctionne sur n'importe quel plan : c'est une simple
connexion Postgres. Faire le dump contre la connection string de
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

### Depuis un dump (méthode active en plan gratuit)

```bash
pg_restore --clean --if-exists -d "$TARGET_DB_URL" aloalo-YYYY-MM-DD.dump
```

(`--clean --if-exists` supprime les objets existants avant de les recréer, sans erreur si
absents.) On ne peut restaurer que ce qu'on a dumpé : la fraîcheur de la restauration =
celle du dernier dump manuel. **D'où l'importance de dumper régulièrement.**

### Depuis PITR (plan Pro uniquement — indisponible en gratuit)

Si/quand on passe en Pro : Dashboard → **Database → Backups → restore-to-timestamp**,
choisir l'instant cible (typiquement juste avant l'incident).

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

Il n'y a **pas** de convention de migration `down`/rollback. Chemins de récupération
(en plan gratuit, le PITR n'est pas disponible) :

1. **Migration forward inverse** (chemin principal en gratuit) : écrire une **nouvelle**
   migration numérotée (`supabase/migrations/0023_*.sql`, prochain numéro libre) qui
   **annule** le changement.
2. **Restauration d'un dump manuel** antérieur à la migration fautive — au prix de la
   perte des données écrites depuis ce dump (cf. §2).
3. **PITR** (plan Pro uniquement) : restaurer juste **avant** que la migration fautive ne
   tourne — l'option la plus sûre pour annuler des effets de données, mais indisponible
   tant qu'on est en gratuit.

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
