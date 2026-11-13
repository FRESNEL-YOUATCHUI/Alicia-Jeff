# Migrations complémentaires Supabase

Les trois CSV dans `docs/database/` ont été lus avant adaptation. Les métadonnées OpenAPI ont ensuite confirmé les colonnes et longueurs en lecture seule. Aucune migration n’a été exécutée sur Supabase hébergé.

| Fichier, à exécuter dans cet ordre après accord | Effet |
| --- | --- |
| `migrations/001_serverless.sql` | Précontrôle des colonnes/RLS/paramètres ; deux tables privées de coordination, index et RPC réservées au serveur. Réutilise les contraintes uniques `ref_hash` et `response_id` ; conserve les UUID. |
| `migrations/002_api_only_access.sql` | Révoque l’accès direct des navigateurs aux tables métier, y compris les droits par colonne. Conserve uniquement la lecture de son propre rôle via la politique existante. |
| `migrations/003_private_storage_access.sql` | Optionnel : ajoute une politique restrictive ciblée sur `wedding-photos` : aucune lecture ou mutation directe avec les rôles navigateur ; accès par capacités signées serveur. Ne modifie pas les autres buckets. |

Les six tables métier, les trois albums, leurs données et leurs contraintes ne sont ni recréés ni supprimés. RLS reste activé. Les migrations sont transactionnelles et rejouables sur la reproduction locale des exports. Les RPC sont `SECURITY INVOKER`, exécutables seulement par `service_role`.

Le précontrôle arrête la transaction si le schéma diverge. Les contraintes et politiques exportées ont été reproduites dans `tests/schema-fixture.sql` par `scripts/build-schema-fixture.mjs` ; les empreintes des fichiers source y figurent. Cette reproduction utilise de faux utilisateurs Auth et n’est pas une sauvegarde des données réelles.

Les cinq exports Storage sont analysés : 44 grants, RLS activé sur les deux tables, aucune politique exportée. Les droits SQL SELECT/INSERT/UPDATE/DELETE ne permettent donc pas aux rôles ordinaires anon/authenticated de contourner le refus par défaut de RLS. La troisième migration est un durcissement **optionnel**, sans nouveau grant, contre une future politique permissive. Les attributs de rôle/propriétaire ne figurent pas dans ces CSV ; les tests modélisent les rôles Supabase standards. Le fichier de grants métier reste limité à 100 lignes. Voir `docs/SECURITE-SUPABASE.md` et `docs/audit/storage-permissions.json`.

Le bucket réel a été vérifié privé. Ses limites actuelles de taille et MIME ne sont pas définies. Proposition explicite à valider : **20 MiB et JPEG/PNG/WebP**. `node scripts/configure-storage.mjs` ne fait qu’une lecture ; `--apply` modifie sa configuration et ne doit être utilisé qu’après accord du propriétaire.

Les imports vont directement du navigateur à Storage. Les intentions expirent après 30 minutes ; une autorisation Supabase d’import peut durer deux heures. Le nettoyage attend au moins 130 minutes après chaque autorisation afin d’éviter qu’un jeton actif recrée un objet supprimé. Une intention finalisée ne peut pas être nettoyée.

Le bouton photographe de nettoyage fonctionne via Bearer + rôle. Un cron quotidien à 03:00 UTC est préparé dans `vercel.json`, protégé par un `CRON_SECRET` distinct d’au moins 32 caractères. Il ne sera actif qu’après votre déploiement et configuration. Aucun cron distant n’a été créé ici.

Avant exécution hébergée : sauvegarde/export, revue des trois fichiers, accord explicite, puis validation des parcours avec données d’essai autorisées. Ne jamais coller de clé dans un chat ou un script SQL versionné.
