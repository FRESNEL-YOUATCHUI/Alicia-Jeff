# Rapport de sécurité Supabase — Alicia & Jeff

> **État courant après activation :** le propriétaire a exécuté le SQL autorisé ; vérification SQL positive, données préservées et `npm run verify` réussi (code 0). Voir [RAPPORT-POST-ACTIVATION.md](RAPPORT-POST-ACTIVATION.md). Les mentions de blocage/attente ci-dessous décrivent les étapes antérieures ; les changements Storage restent non appliqués.

Audit des exports disponibles le 13 novembre 2026 (UTC). **Aucune politique, permission, donnée réelle ou configuration hébergée modifiée. Aucun push et aucun déploiement.**

## Conclusion Storage

**Les exports ne démontrent aucun accès direct autorisé aux photos privées pour les rôles ordinaires `anon` et `authenticated`.** Les deux tables Storage ont RLS activé ; l’export de politiques indique `NO_POLICY_DEFINED`. En l’absence de politique applicable, PostgreSQL refuse l’accès aux lignes pour un rôle non propriétaire et sans `BYPASSRLS`, même lorsqu’il possède les grants SQL nécessaires. [Règles RLS PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Il serait donc incorrect de conclure « les visiteurs peuvent lire ou modifier les photos » à partir des seuls `can_select/can_insert/can_update/can_delete=true`. Les tests locaux reproduisent précisément cette combinaison et confirment le refus.

Cette conclusion est fondée sur les instantanés fournis. Ils ne contiennent pas les attributs `BYPASSRLS`, les propriétaires, les appartenances héritées, l’USAGE du schéma ni les droits par colonne. Le modèle de test utilise les rôles Supabase standards : `anon/authenticated` ordinaires et `service_role` privilégié. Aucun test HTTP d’écriture ou téléchargement d’objet réel n’a été effectué sur Supabase. Le script `supabase/inspect-storage-readonly.sql` permet de compléter ces propriétés lors d’un prochain contrôle.

## Preuves analysées

Les cinq fichiers `docs/database/storage_*.csv` ont été intégralement lus :

| Export | Constat |
| --- | --- |
| `storage_bucket.csv` | `wedding-photos` existe, `public=false`, limite de taille et liste de MIME non définies. |
| `storage_rls.csv` | `storage.objects` et `storage.buckets` : RLS activé, FORCE RLS désactivé. |
| `storage_policies.csv` | Une ligne sentinelle `NO_POLICY_DEFINED`, soit aucune politique exportée sur les deux tables. Ce n’est pas le nom d’une politique réelle. |
| `storage_grants.csv` | 44 grants explicites. Pour `anon/authenticated` : SELECT, INSERT, UPDATE et DELETE sur les deux tables ; aucun TRUNCATE, REFERENCES ou TRIGGER directement accordé à ces rôles dans cet export. |
| `storage_effective_privileges.csv` | 6 couples rôle/table. Les quatre droits SQL de lignes sont vrais pour chacun des trois rôles sur chacune des deux tables. Ce résultat n’évalue pas les conditions RLS. |

Empreintes SHA-256, nombre de lignes et matrice d’analyse : `docs/audit/storage-permissions.json`. Reproduction locale générée par `node scripts/audit-storage-exports.mjs` : `tests/storage-fixture.sql`. Cette fixture contient des lignes synthétiques et un propriétaire synthétique ; ce n’est ni une sauvegarde ni une migration des tables Storage réelles.

Les exports métier `wedding_*` précédemment fournis restent analysés. `wedding_grants.csv` compte exactement 100 lignes et s’arrête au milieu de `wedding_settings` : son exhaustivité reste douteuse. Cette réserve est distincte des cinq exports Storage désormais reçus.

## Lecture croisée SQL et RLS

| Rôle et tables | Autorisations SQL exportées | RLS / politiques | Conséquence pour un rôle standard |
| --- | --- | --- | --- |
| `anon`, objects et buckets | SELECT, INSERT, UPDATE, DELETE | Activé, aucune politique | SELECT ne renvoie pas les lignes ; INSERT est refusé ; UPDATE/DELETE ne trouvent aucune ligne autorisée. Pas de création, renommage, changement de bucket, suppression de photo ou changement de visibilité autorisés par ces règles. |
| `authenticated`, objects et buckets | Mêmes droits | Activé, aucune politique | Même refus, y compris pour un compte connecté sans rôle photographe. Une simple connexion n’autorise donc pas l’import direct. |
| `service_role`, objects et buckets | Mêmes droits de lignes et privilèges SQL supplémentaires | Rôle serveur Supabase privilégié | Accès serveur attendu ; le contournement RLS est une propriété du rôle, pas une permission publique. Les attributs du rôle ne sont pas mesurés par ces CSV. |

`rls_forced=false` n’annule pas RLS pour les utilisateurs ordinaires. Il concerne notamment le comportement du propriétaire ; `BYPASSRLS` constitue une autre exception. Les grants et politiques restent deux contrôles distincts. Les opérations de table entière, dont TRUNCATE et REFERENCES, ne sont pas protégées par RLS. Les quatre booléens effectifs exportés ne couvrent pas ces opérations. [Documentation PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Aucune politique n’est actuellement susceptible de créer une exception pour `wedding-photos` dans l’export. Si une politique permissive large visant `authenticated` ou PUBLIC était ajoutée ultérieurement, l’accès pourrait changer. Un filtre `auth.role() = 'authenticated'` ne vérifierait pas, à lui seul, le rôle photographe.

## URL signées et architecture retenue

Un accès direct ordinaire à Storage et l’utilisation d’une capacité signée sont deux parcours différents. Le serveur peut émettre une URL autorisant temporairement un téléchargement ou un import sans ouvrir globalement le bucket. Aucune politique navigateur permissive n’est nécessaire pour l’architecture retenue : l’API vérifie le Bearer avec `getUser` et le rôle métier avant d’émettre une autorisation d’import. La galerie vérifie date, publication globale, album et visibilité avant signature. [Contrôle d’accès Storage](https://supabase.com/docs/guides/storage/security/access-control).

Une URL de consultation signée est transmissible et reste utilisable jusqu’à son expiration. Dans ce projet, TTL 600 secondes et réponses API sans cache ; une dépublication bloque les nouvelles signatures, sans révoquer instantanément les liens déjà émis ni les copies téléchargées.

Les jetons d’import Supabase durent deux heures. Les intentions applicatives expirent en 30 minutes et le nettoyage attend au moins 130 minutes après la dernière émission. Chemins aléatoires serveur, sans écrasement, finalisation idempotente et vérification de l’objet empêchent une répétition de créer plusieurs métadonnées photo. [Autorisations d’import signées](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).

Ces parcours signés sont préparés dans le code et testés avec un Storage simulé. Leur exécution complète sur le service hébergé reste à valider après autorisation ; les tests SQL ne remplacent pas cette validation réseau.

## Risques et corrections proposées

| Priorité | Constat | Proposition, non appliquée à distance |
| --- | --- | --- |
| Moyenne, confirmée Storage | Le bucket est privé, mais ses limites taille/MIME sont nulles. Les contrôles backend ne constituent pas une limite d’ingestion du bucket au moment de l’envoi signé. | Configurer 20 971 520 octets, JPEG/PNG/WebP. `scripts/configure-storage.mjs` reste en lecture seule sans `--apply`. |
| Durcissement facultatif Storage | Les grants SQL de lignes sont larges, mais RLS les bloque actuellement. Une future politique permissive pourrait rendre ces grants utilisables. Aucune fuite Storage actuelle n’est déduite de ces grants. | Proposition 003 : ajouter uniquement des politiques restrictives ciblées sur le bucket dans les deux tables, sans nouveau grant et sans affecter les autres buckets. Pas de révocation globale Storage proposée sans connaître les besoins des autres buckets. |
| Haute, confirmée sur les tables métier | L’export `wedding_grants.csv` contient TRUNCATE pour `anon/authenticated` sur certaines tables métier. RLS ne protège pas cette opération ; une exploitation distante dépend d’une interface SQL/RPC permettant de l’invoquer, non démontrée ici. | Migration 002 : retirer les droits navigateur métier, y compris par colonne, conserver la lecture de son propre rôle. Cette observation ne concerne pas les grants Storage des visiteurs. |
| Haute, confirmée sur les métadonnées métier | Les politiques métier SELECT albums/photos ignorent `gallery_published` et `release_at` : les métadonnées d’un album publié trop tôt pourraient être lues indépendamment du verrou global. Cela ne prouve pas la lecture des octets du bucket privé. | Consultation métier via les API et leurs vérifications ; migration 002. |
| Contrôle renforcé localement | Le bucket doit rester privé entre l’autorisation d’import et la finalisation. | Le backend recontrôle désormais son caractère privé avant de valider l’objet. La proposition 003 refuse un bucket devenu public, sans le remettre privé automatiquement. |

La clé serveur est exclusivement destinée au backend. Son pouvoir privilégié rend indispensable le contrôle du rôle métier avant signature. Les contrôles de bundle et de fichiers préparés pour Git n’ont pas détecté les valeurs privées configurées. Aucun secret n’est reproduit dans ce rapport.

## Migrations et tests locaux

- 001 : persistance/RPC et coordination des imports, sans recréation des tables métier ou albums.
- 002 : permissions métier adaptées aux API, sans suppression de données.
- 003 : **optionnelle**, défense supplémentaire contre une future politique permissive. Le refus actuel ne dépend pas de son application. Elle vérifie RLS, l’existence et le caractère privé du bucket, puis ses propres définitions lors d’une répétition. Elle ne crée aucune politique permissive et n’accorde aucun droit.

Tests PostgreSQL locaux sur les exports Storage : grants SQL vrais mais lecture vide, insertion refusée, mise à jour et suppression sans ligne autorisée pour anon/authenticated ; maintien du parcours serveur privilégié ; répétition de 003 ; refus si le bucket devient public ; protection du bucket cible même en présence d’une politique permissive large simulée, sans bloquer un autre bucket.

Les autres tests couvrent l’autorisation API, RSVP/billets, messages/modération, formats d’images, reprise/idempotence et nettoyage. Les résultats détaillés et les limites des tests hébergés figurent dans `RAPPORT-FINAL.md`.

**Aucune correction distante n’est exécutée sans votre accord.** Restent à autoriser : activation des migrations nécessaires, choix du durcissement 003, limites du bucket et essais réels avec données de test. Le projet n’est pas déclaré validé en production sur la seule base des exports et des tests locaux.
