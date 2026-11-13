# Rapport de sécurité Supabase — Alicia & Jeff

Audit local du 13 novembre 2026. **Aucune politique, permission, donnée réelle ou configuration hébergée n’a été modifiée.** Aucun push ni déploiement.

## Périmètre et preuves

Analysés : exports `wedding_columns.csv`, `wedding_constraints.csv`, `wedding_policies.csv`, `wedding_rls.csv`, `wedding_indexes.csv`, `wedding_grants.csv` et `wedding_bucket.csv` dans `docs/database/`. L’introspection REST et les compteurs/bucket ont été vérifiés en lecture seule avec la configuration serveur locale.

Les cinq exports `storage_bucket.csv`, `storage_rls.csv`, `storage_policies.csv`, `storage_grants.csv` et `storage_effective_privileges.csv` ne sont pas présents au moment de cette rédaction. **L’audit des politiques réelles de storage.objects et storage.buckets reste donc incomplet.** L’absence de ces fichiers n’indique pas une absence de politiques ou de droits.

`wedding_grants.csv` contient exactement 100 lignes et s’arrête au milieu des entrées de `wedding_settings` : export probablement limité. Les lignes présentes constituent des preuves ; les lignes absentes ne permettent aucune conclusion. Exporter tous les résultats avec `supabase/inspect-storage-readonly.sql`, qui fournit les cinq jeux de résultats demandés, et un export complet des grants métier.

## Résultats

| Priorité | Observation et portée réelle | Correction proposée |
| --- | --- | --- |
| Haute, confirmée | `anon` et `authenticated` ont de nombreux droits SQL sur albums, photos et paramètres, dont `TRUNCATE`. Les politiques de lignes ne protègent pas cette opération. Une exploitation distante suppose toutefois une interface SQL/RPC qui permette de l’invoquer ; elle n’a pas été démontrée sur le projet réel. | Migration 002 : retirer les droits navigateur métier, y compris par colonne, et conserver la lecture de son propre rôle. Démonstration et correction testées sur une fixture synthétique. |
| Haute, confirmée | Les politiques SELECT albums/photos vérifient publication/masquage mais pas `gallery_published` ni `release_at`. Un album publié trop tôt peut exposer ses métadonnées indépendamment du verrou global. Cela ne prouve pas un accès aux octets d’une photo privée. | Accès métier exclusivement par les API qui vérifient tous les verrous avant signature. Migration 002. |
| À vérifier, bloquant pour un verdict Storage complet | Le bucket est privé, mais les politiques et droits effectifs Storage ne sont pas encore exportés. Impossible de certifier les refus SELECT/INSERT/UPDATE/DELETE des visiteurs et des comptes sans rôle. | Analyser les cinq CSV manquants. Proposition 003 : politiques restrictives ciblées sur le bucket dans `objects` et `buckets` ; pas de nouveau droit accordé. Revue des droits globaux `TRUNCATE/REFERENCES/TRIGGER` indispensable si présents. |
| Moyenne, confirmée | Limites de taille/MIME du bucket non définies. Le backend valide déjà 20 MiB et les signatures de contenu, mais un jeton signé doit aussi être borné par la configuration Storage. | Configurer 20 971 520 octets et JPEG/PNG/WebP par l’API Storage après accord. Le script de configuration est en lecture seule sans `--apply`. |
| Limite connue des capacités signées | Une URL signée peut être transmise et reste utilisable jusqu’à expiration. Une dépublication empêche de nouvelles signatures mais ne révoque pas instantanément les liens déjà délivrés ni les copies téléchargées. | Consultation : TTL 600 s, pas de cache API, renouvellement pendant la consultation. Import : chemin aléatoire et sans écrasement, intention 30 min et nettoyage après expiration du jeton. |
| Protection serveur vérifiée localement | Chaque API administrative valide `getUser(token)` puis le rôle en base ; elle ne fait pas confiance à l’état React. La clé serveur n’est pas dans les artifacts frontend analysés. | Maintenir la clé exclusivement côté serveur, RPC réservées à `service_role`, aucun secret dans Git ou les logs. La clé serveur permet intentionnellement de contourner RLS. |

PostgreSQL distingue les privilèges SQL, les règles par ligne et leurs exceptions : RLS ne couvre pas `TRUNCATE` ni `REFERENCES`. Les politiques permissives se combinent généralement par OR ; les politiques restrictives ajoutent un AND. Le propriétaire et les rôles `BYPASSRLS` ont un traitement particulier. [Documentation PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## Analyse Storage à compléter avec les CSV

Pour chaque table `storage.objects` et `storage.buckets`, vérifier séparément :

1. RLS réellement activé sur la table ; `rls_forced=false` n’est pas une désactivation. Les index présents dans `wedding_rls.csv` ne sont pas des tables et leur indicateur RLS ne signale pas une faille.
2. Droits effectifs de `anon`, `authenticated` et `service_role` : droits de schéma, droits hérités de PUBLIC ou d’autres rôles, droits par colonne, propriétaire et `BYPASSRLS`. Un grant SELECT seul ne suffit pas si RLS refuse la ligne ; un RLS activé ne retire pas un privilège SQL.
3. Toutes les politiques applicables, y compris `ALL` et celles visant PUBLIC. Un simple `auth.role() = 'authenticated'` ne vérifie pas le rôle photographe. Inspecter USING pour lecture/suppression et WITH CHECK pour insertion/mise à jour, avec filtre exact `bucket_id = 'wedding-photos'` ou `id = 'wedding-photos'` selon la table.
4. Absence de politique autorisant une lecture anonyme, une écriture sans rôle, un changement de bucket ou une modification de sa visibilité. Une politique supplémentaire permissive peut annuler une restriction supposée d’une autre politique permissive.
5. `service_role` doit servir uniquement au backend. Son accès privilégié n’est pas une politique destinée aux visiteurs.

Un bucket privé reste accessible par une requête authentifiée autorisée ou une URL signée. Les capacités signées permettent un accès temporaire sans ouvrir globalement le bucket ; leur émission doit donc être protégée côté serveur. [Buckets privés](https://supabase.com/docs/guides/storage/buckets/fundamentals), [contrôle d’accès Storage](https://supabase.com/docs/guides/storage/security/access-control).

La proposition 003 ne remplace pas l’audit manquant. Elle ne révoque pas les privilèges de table globaux de Storage : ceux-ci devront être examinés sans casser d’autres buckets. Elle refuse son exécution si RLS n’est pas déjà activé et vérifie la définition de ses propres politiques lors d’une répétition. Elle ne supprime aucune politique existante.

## Import, nettoyage et tests

Import direct navigateur → bucket privé ; pas de transit de la photo de 20 MiB par Vercel. Vérifications serveur de l’objet : taille/MIME retournés par Storage, signature PNG/JPEG/WebP, dimensions et marqueurs de fin attendus, avec lectures Range limitées à environ 128 Kio. C’est une validation de format bornée, pas un antivirus ni un décodage intégral de tous les pixels.

Chemins générés côté serveur, références d’import idempotentes, deux transferts simultanés côté client et cinq intentions actives par photographe côté base. La finalisation est transactionnelle et protégée par un bail/nonce. Aucun objet invalide ou incomplet n’est publié. Les objets abandonnés restent privés en attente de nettoyage.

Les autorisations d’import Supabase durent deux heures ; le nettoyage attend au moins 130 minutes après leur dernière émission. Le cron quotidien protégé et le nettoyage manuel sont préparés, non activés à distance. [Durée des autorisations d’import](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).

Tests réellement exécutés : rôles administratifs simulés, contrôles SQL/RLS dans PostgreSQL embarqué, politique restrictive contre une politique permissive large sur les deux tables Storage synthétiques, preuve locale du comportement TRUNCATE, MIME/taille et contenu des vraies images du site. Les requêtes Vercel Dev anonymes et avec jeton invalide ont été vérifiées contre la configuration réelle en lecture seule.

**Non exécutés sur le projet hébergé :** migration, modification des grants/politiques, création de RSVP/message, import/suppression de photo et validation avec le vrai compte photographe. Le projet ne peut pas être déclaré entièrement validé en production avant ces essais autorisés et l’audit Storage complet.
