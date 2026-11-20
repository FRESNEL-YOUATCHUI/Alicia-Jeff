# Alicia & Jeff — livraison et validation du 20 novembre 2026

## Démarrage

Node.js 22, dépendances npm installées. Depuis le dossier alicia-jeff-site-local-v3 :

```powershell
npm run dev
# Contrôles automatisés :
npm run verify:delivery
# Build seul :
npm run build
```

L’invitation est sur http://127.0.0.1:3000/. Le tableau de bord est sur /photographe.
Le même gateway Vercel et les mêmes contrôles serveur sont utilisés en local. .env.local n’est pas modifié ni affiché.
Attention : npm run dev utilise le vrai Supabase configuré. Les soumissions valides y sont enregistrées.
Pour les tests sans effet sur la production, utiliser npm run test:browser après le build : API et SQL réels sur PGlite,
avec Auth, Storage et Sheets simulés. Le navigateur Edge installé est utilisé en mode headless ; aucune donnée de production n’est envoyée.
Sur une machine équipée de Chrome, WEDDING_BROWSER_CHANNEL=chrome peut être utilisé pour le test navigateur.

## État de livraison

Le bilan actuel est docs/RAPPORT-FINAL.md et sa preuve structurée docs/audit/finalisation-20261120.json.
Les autres rapports datés sont historiques. La connexion Google réelle n’est PAS déclarée validée tant que
le diagnostic de lecture Production n’a pas renvoyé succès après votre déploiement.

La migration 004 est déjà appliquée. Ne pas la rejouer. La migration 005_draft_uploads.sql est préparée localement,
non exécutée à distance, et exige un accord explicite. Elle ajoute deux fonctions service-only pour finaliser
les nouveaux imports avec hidden=true, sans modifier les anciennes fonctions ou les photos existantes.
Tant que 005 est absente, le nouveau backend refuse les imports plutôt que de rendre une photo publique prématurément.
Appliquer 005 après autorisation AVANT de déployer ce nouveau parcours. Le rollback dédié conserve toutes les données.

## Photographe

Le lien Espace photographe ouvre une page dédiée. Session et rôle sont vérifiés par Supabase Auth côté serveur.
Choisir un album, sélectionner des fichiers, contrôler les aperçus, puis Importer. Les nouveaux fichiers restent en brouillon.
Sélectionner les brouillons puis Publier les photos. Albums et galerie conservent leurs contrôles de visibilité et la date existante.
Le bouton Autoriser la galerie ne contourne pas la date de disponibilité. Les URL signées déjà émises restent valables au plus dix minutes.

## Propriétaire et Google

Aucune promotion automatique du photographe en admin. Le mécanisme à durée courte et scope unique est décrit dans
[le guide Google](docs/GOOGLE-SHEETS-LECTURE-PRIVEE.md). npm run owner:grant -- --user-id UUID produit un fichier
privé ignoré par Git ; il ne faut l’exécuter que juste avant le contrôle Production, après déploiement.
La page photographe permet de charger ce fichier sans afficher le jeton.

## Déploiement réservé au propriétaire

Aucun commit, push ou déploiement n’est effectué automatiquement. Un push sur la branche de production peut déclencher
Vercel via l’intégration Git. Regrouper l’approbation SQL 005, son contrôle, votre déploiement et la validation réelle
Google/Auth/Storage selon la liste unique du rapport final. Aucun secret ne doit être copié dans le chat ou Git.

npm start et npm run preview servent le build et le vrai backend Supabase. Le backend historique est accessible uniquement
par npm run dev:legacy et reste conservé. Les données historiques, sauvegardes et résultats privés restent ignorés.
