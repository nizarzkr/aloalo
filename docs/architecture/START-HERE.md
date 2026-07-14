# 🗺️ Architecture Aloalo — mode d'emploi

Ce dossier est un **vault Obsidian** : une carte interactive de l'application,
où tu **cliques sur les boîtes** pour zoomer sur chaque élément (comme Google Maps).

## Comment l'ouvrir (1 fois)

1. Télécharge **Obsidian** (gratuit) : https://obsidian.md
2. Ouvre Obsidian → **« Open folder as vault »** (Ouvrir un dossier comme vault).
3. Choisis ce dossier : `Desktop/aloalo/docs/architecture`
4. Ouvre la note **[[Carte-globale]]** → c'est ta vue d'ensemble.

> Dans Obsidian, les boîtes des diagrammes sont **cliquables** : un clic t'ouvre
> la note détaillée. Chaque note détaillée a un lien **↑ Carte globale** pour revenir.
> Si jamais un clic-sur-boîte ne réagit pas (selon ta version d'Obsidian), utilise
> la **liste de liens** placée juste sous chaque diagramme — elle fait la même chose.

## Ce qu'il y a dedans

- **[[Carte-globale]]** — vue d'ensemble : le chemin d'un appel, les bases, les services externes.
- **[[Pipeline-appel]]** — le voyage détaillé d'un appel, étape par étape.
- **[[Securite]]** — qui peut lire/écrire quoi, les secrets, les gardes.
- Les **bases de données** : [[Base-calls]], [[Base-analyses]], [[Base-organizations]],
  [[Base-profiles]], [[Base-usage_logs]], [[Base-invitations]].

## Bon à savoir

Ces cartes sont écrites en **Mermaid** (du texte qui se dessine tout seul) et vivent
**dans ton repo**, à côté du code. Quand le code évolue, on met ces fichiers à jour
en même temps — la carte reste vraie. Tu peux aussi les lire dans GitHub (les
diagrammes s'affichent), mais seuls **Obsidian** rend les boîtes cliquables.

*Première version : 2026-06-11. Couvre l'angle « données ». Les cartes par feature viendront ensuite.*
