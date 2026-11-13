# Audit initial — migration Supabase / Vercel

Projet audité : dossier `alicia-jeff-site-local-v3` fourni par l’utilisateur. Aucune modification de données hébergées, aucun push et aucun déploiement.

## État constaté avant modification

- Branche initiale : `main`, commit `7c40378` (`premier commit`). Une modification préexistante ajoute `.vercel` à `.gitignore` ; elle sera conservée et exclue des commits de cette intervention.
- Branche de travail : `codex/supabase-vercel-finalisation`.
- Frontend React/Vite/TypeScript ; design, feuille de style, textes, enveloppe et portraits conservés.
- `src/lib/supabase.ts` et `photographerAuth.ts` utilisent la clé publique et Supabase Auth ; le rôle est déjà contrôlé côté client mais ce contrôle n’autorise aucune mutation serveur.
- `PhotographerPanel.tsx` ne charge pas l’état après une connexion ou une session restaurée. Il présente volontairement un message « migration à venir ».
- `src/lib/api.ts` transmet déjà un Bearer aux routes `/api/admin/*`.
- Le proxy Vite dirige toutes les API vers le serveur local 8787. Il masque donc toute implémentation Vercel tant que le lancement reste inchangé.
- `server/index.mjs` stocke les données dans un fichier JSON, les photos sur disque et utilise un cookie de session local. Ce modèle ne convient pas aux instances serverless ni à l’authentification Supabase du nouveau frontend.
- `api/_lib/state.mjs` contient un handler, mais aucun fichier ou routage ne l’expose en `/api/admin/state`. Les helpers sont actuellement dans le répertoire des fonctions publiques ; ils seront isolés après examen de leurs imports.
- Aucun routage Vercel du site n’est déclaré à la racine. La liaison existante indique le projet `alicia-jeff`.
- Les imports photo sont envoyés en binaire au backend. Ils doivent passer directement du navigateur à Storage via une autorisation signée, puis être validés et finalisés côté serveur.
- Les références des billets sont `AJ:<uuid>` ; le numéro imprimé est `AJ-` suivi des huit premiers caractères de l’UUID. Les UUID existants doivent être conservés lors d’un import éventuel.
- Des interfaces TypeScript historiques décrivent des tables différentes de `wedding_*`. Les nouveaux contrats API seront explicités sans changer l’affichage des billets.

## Configuration observée sans affichage des valeurs

`.env.local` contient les deux variables frontend `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. Les variables serveur `SUPABASE_URL` et `SUPABASE_SECRET_KEY` n’y sont pas présentes à la date de cet audit. Le fichier `.env.wedding.local` de l’ancien backend est ignoré et n’est pas modifié.

La clé publique atteint le service Auth (HTTP 200). L’endpoint d’introspection OpenAPI REST refuse cette clé (HTTP 401), y compris avec le format d’en-têtes SDK. Aucun schéma privé ni aucune donnée de visiteur n’a été extrait. L’existence des six tables, des albums et du bucket est déclarée dans la demande mais leurs contraintes SQL doivent encore être vérifiées avec une connexion autorisée ou un export local.

## Risques à traiter

1. Mélange de cookies locaux et de Bearer Supabase : risque d’administration inutilisable ou de contrôle incomplet.
2. Liste des photos et paramètres accessibles uniquement par un vrai rôle serveur ; une session frontend seule ne suffit pas.
3. Données en mémoire/disque non durables sur Vercel.
4. Photo de 20 Mo incompatible avec un transit HTTP ordinaire par les fonctions ; nécessité d’un envoi direct signé.
5. Albums masqués, galerie fermée et date future à vérifier avant chaque délivrance de lien signé.
6. Idempotence, concurrence et nettoyage des imports interrompus à traiter durablement dans PostgreSQL, sans limiteur en mémoire présenté comme une protection distribuée.
7. Migration et validation réelles bloquées tant que le schéma SQL exact et la configuration serveur ne sont pas disponibles. Aucun succès en production ne sera prétendu sur la seule base de doubles de test.

## Périmètre autorisé

Code, documentation, tests isolés, migrations préparées et commits locaux. L’ancien backend et les données locales sont conservés. Toute exécution de migration, modification de données réelles, de secrets, de permissions ou de production requiert l’accord explicite de l’utilisateur.

## Complément après réception des exports et de la configuration

Les trois CSV `docs/database/wedding_{columns,constraints,policies}.csv` fournis par le propriétaire ont été analysés. L’introspection OpenAPI avec la clé serveur locale a confirmé les colonnes et longueurs. Les exports décrivent **33 colonnes, 20 contraintes et 3 politiques** ; ils servent à reconstruire la fixture locale.

- `wedding_rsvps.ref_hash` est déjà obligatoire et unique. Il doit être utilisé directement pour conserver les UUID et QR existants ; aucune table de références parallèle n’est nécessaire.
- `wedding_messages.ref_hash` et `response_id` sont uniques ; `response_id` référence RSVP avec `ON DELETE SET NULL`. Les messages de confirmation sont donc liés dans la même transaction et une répétition ne réactive pas un message masqué.
- `wedding_photos.album_id` référence les albums avec `ON DELETE CASCADE` ; `storage_path` est unique. Ces contraintes sont conservées.
- `wedding_staff.user_id` référence `auth.users` avec suppression en cascade, rôle limité à `photographer/admin`. Sa politique existante limite la lecture à son propre rôle.
- Les politiques publiques albums/photos omettent `gallery_published` et `release_at`. L’accès direct est donc révoqué dans une migration dédiée ; la consultation passe par les API qui appliquent ces deux règles.
- Lecture seule réelle : trois albums, aucun RSVP/message/photo, un compte staff, bucket privé. Aucune donnée historique locale à importer. Les limites MIME/taille du bucket ne sont pas configurées.
- Aucun SQL hébergé exécuté ; les modifications de permissions proposées restent soumises à accord explicite.

## Complément Storage après réception des cinq exports

Les cinq fichiers storage_*.csv fournis sont désormais analysés : 44 grants explicites, RLS activé sur objects et buckets, et aucune politique exportée. Les quatre privilèges SQL de lignes sont vrais pour les six couples rôle/table ; ils ne suffisent pas à autoriser des lignes lorsque RLS applique son refus par défaut. Les tests locaux utilisent un propriétaire synthétique et les rôles Supabase standards, car ces attributs ne sont pas inclus dans les exports. Aucun accès public Storage n’est déduit des seuls grants. Le durcissement 003 reste facultatif et non appliqué. Voir SECURITE-SUPABASE.md et audit/storage-permissions.json.
