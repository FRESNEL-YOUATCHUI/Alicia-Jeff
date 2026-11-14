# Audit préalable à l’activation Supabase — Alicia & Jeff

> **État courant après activation :** le propriétaire a exécuté le SQL autorisé ; vérification SQL positive, données préservées et `npm run verify` réussi (code 0). Voir [RAPPORT-POST-ACTIVATION.md](RAPPORT-POST-ACTIVATION.md). Les mentions de blocage/attente ci-dessous décrivent les étapes antérieures ; les changements Storage restent non appliqués.

14 novembre 2026, UTC. Dossier : `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`.

**Décision : activation hébergée suspendue.** L’audit du code SQL, les corrections locales, la préparation du retour arrière et les essais PostgreSQL isolés sont terminés. Les droits SQL actuels complets ne sont pas encore capturés : il serait incorrect de déclarer le rollback spécifique à la production prêt ou la sauvegarde transactionnelle réalisée. L’accord de principe n’est pas une autorisation d’exécuter. Aucun DDL, changement de permission, écriture métier, push ou déploiement distant n’a été effectué.

> Mise à jour après réception de la capture réelle : les précontrôles et le rollback sont désormais validés dans [VALIDATION-CAPTURE-AVANT-ACTIVATION.md](VALIDATION-CAPTURE-AVANT-ACTIVATION.md). Les mentions ci-dessous d’instantané manquant décrivent l’état initial ; aucune activation hébergée n’a été exécutée.

## 1. Périmètre et dépendances examinés

Lecture intégrale de `001_serverless.sql`, `002_api_only_access.sql`, de leur assemblage `activate-serverless.sql`, du générateur, des six exports de structure/contraintes/index/RLS/politiques/droits métier, des cinq exports Storage, et des modules `handler`, `http`, `repository`, `supabase`, `storage`, `validation`. Les appels Auth et les accès frontend ont été confrontés aux nouveaux droits. La migration Storage optionnelle 003 est exclue.

Les six tables et les 31 colonnes utilisées sont accessibles par le backend configuré. Les exports recensent 20 contraintes : six clés primaires, les uniques RSVP/message/photo, les contrôles de saisie, et les trois FK existantes. L’export de grants métier, limité à 100 lignes, ne permet pas de reconstruire les ACL exactes, options de délégation et droits par colonne. Il ne sert donc pas à inventer un rollback.

Dépendances PostgreSQL : PL/pgSQL, JSONB, UUID/gen_random_uuid, verrous transactionnels consultatifs, ON CONFLICT, SKIP LOCKED et notifications PostgREST. Les deux rôles visiteurs doivent être ordinaires, sans BYPASSRLS/superuser ni CREATE sur public ; service_role doit disposer de BYPASSRLS et de l’USAGE des schémas nécessaires. Les grants SQL et les politiques RLS sont contrôlés séparément.

## 2. Modifications réellement proposées

| Objet | Effet à l’activation | Données existantes |
| --- | --- | --- |
| Six tables métier | Aucune recréation, modification de colonne, de défaut, de contrainte, de FK ou de ligne. Droits navigateur révoqués, y compris droits par colonne. | Conservées. |
| RLS et politiques métier | RLS conservé ; aucune politique métier existante créée, modifiée ou supprimée. La politique de lecture de son propre rôle est vérifiée. | Aucun effet de contenu. |
| wedding_staff | authenticated conserve uniquement SELECT(user_id,role), soumis à sa politique de propre compte. | Comptes et rôles inchangés. |
| wedding_api_limits | Nouvelle table privée de limitation de débit ; clé hashée et compteurs. | Aucune ligne insérée à l’activation. |
| wedding_api_uploads | Nouvelle table privée d’intentions d’import ; FK album ON DELETE RESTRICT, unicité, contrôles MIME/taille/statut. | Aucune ligne insérée à l’activation. |
| Trois index | Nettoyage des intentions ; ordre album/photos ; pagination des messages. | Pas de transformation de données ; coût disque et verrous à prévoir. |
| Vingt fonctions | Création/remplacement des signatures exactes du manifeste ; aucune fonction exécutée pour créer des RSVP/photos. | Les écritures de leurs corps ne s’exécutent que lors d’appels ultérieurs. |
| EXECUTE des vingt signatures | Retrait des grants PUBLIC et rôles explicites issus des valeurs par défaut ; EXECUTE réservé à service_role et au propriétaire. | Pas de changement sur des fonctions ou surcharges étrangères au manifeste. |
| Storage, Auth et secrets | Aucune modification de bucket, politique/grant Storage, compte Auth, clé ou secret. | Objets et identités conservés. |

Les grants antérieurs de service_role sur les tables métier ne sont pas tous révoqués : cette activation n’est pas une réduction exhaustive des pouvoirs de cette clé privilégiée. Les grants navigateur hérités qui subsisteraient provoquent un échec et le rollback de la transaction, plutôt qu’une autorisation silencieuse.

### Absence d’altération de données

Au niveau principal, le SQL contient des contrôles SELECT, DDL, GRANT/REVOKE et NOTIFY, sans INSERT/UPDATE/DELETE/TRUNCATE métier exécuté à l’activation. Les DELETE présents dans les corps des fonctions concernent les anciens compteurs de limitation ; ils ne sont pas exécutés par la migration. Le nettoyage Storage est un appel ultérieur explicite de l’API, distinct de l’activation.

La conservation a été vérifiée sur les six tables toutes peuplées : contenu complet, UUID, dates, champs privés/modération, colonnes/défauts, contraintes, triggers, propriétaires, RLS et politiques identiques après deux activations. Cela démontre le comportement sur la fixture issue des exports, pas l’absence de dérive actuelle sur le serveur hébergé.

## 3. Sécurité des fonctions et des routes

Toutes les fonctions portent explicitement SECURITY INVOKER. Aucune élévation SECURITY DEFINER n’est introduite. Le contexte est fixé à `search_path=pg_catalog,pg_temp` ; les tables et appels applicatifs utilisent le préfixe public. Le schéma public, potentiellement modifiable, n’est plus dans le chemin de résolution des fonctions. Les fonctions intégrées sont résolues dans pg_catalog.

La boucle de permissions visait initialement tout le préfixe wedding_api_. Elle est maintenant limitée aux **20 signatures exactes** de `scripts/lib/activation-manifest.mjs`. Les fonctions étrangères et surcharges homonymes ne sont pas modifiées. Les grants EXECUTE par défaut à un rôle personnalisé sont également retirés. Après définition, les propriétés de sécurité et l’absence de droit effectif anon/authenticated sont vérifiées ; tout échec annule la transaction. Les privilèges du propriétaire et des administrateurs PostgreSQL restent inhérents à leur rôle, comme attendu.

| Signatures wedding_api_ | Lecture/écriture et contrôle |
| --- | --- |
| assert_staff(uuid) | Vérifie l’appartenance admin/photographer. |
| rate(text,integer,integer) | Écrit/nettoie uniquement les compteurs privés ; clé HMAC calculée au backend. |
| rsvp(jsonb) | UPSERT lors d’une confirmation ; conserve UUID et modération d’un message existant. Verrou par référence. |
| message(jsonb) | UPSERT d’un message lors d’un envoi ; la modération n’est pas annulée. |
| messages(integer) | Messages visibles seulement ; pagination. |
| gallery_open() | Publication globale ET date de disponibilité. |
| public_state() | Messages visibles et albums autorisés ; aucune liste de confirmations. |
| public_photos(uuid,integer) | Vérifie date, publication, album non masqué et photos visibles. |
| public_photo(uuid) | Même contrôle pour un lien individuel. |
| admin_photos(uuid,integer), admin_messages(integer), admin_state() | Métadonnées administratives ; JWT et rôle contrôlés par le handler avant l’appel SQL. |
| mutate(text,uuid,jsonb,uuid) | Mutations autorisées après contrôle staff ; saisies validées par le backend. |
| upload_reserve(jsonb,uuid) | Intention d’import, chemin aléatoire, idempotence et limite de concurrence ; contrôle staff. |
| upload_claim(uuid,uuid) | Verrou et bail de validation, contrôle staff et album. |
| upload_release(uuid,uuid,uuid) | Libère le bail de l’intention appartenant au staff. |
| upload_complete(uuid,uuid,uuid) | Vérifie bail/nonce puis crée une seule métadonnée photo ; objet contrôlé auparavant par le backend. |
| upload_cancel(uuid,uuid) | Annule l’intention du staff sans supprimer de photo publiée. |
| cleanup_claim(), cleanup_done(uuid[]) | Nettoyage des intentions expirées ; endpoint staff ou cron avec secret distinct. |

Ces fonctions sont des primitives serveur : elles ne déduisent pas toutes un utilisateur final depuis auth.uid(). Le backend valide le Bearer avec Supabase getUser et lit wedding_staff avant les routes administratives. Il fournit ensuite le vrai UUID staff. Un visiteur ne peut pas appeler ces primitives SQL directement. La clé serveur demeure donc une frontière de confiance forte ; sa compromission ne serait pas contenue par ces fonctions ou RLS.

Les deux rôles applicatifs admin et photographer gardent les autorisations existantes de l’interface, dont publication et modération. L’audit ne crée pas une nouvelle séparation de leurs pouvoirs.

### Impact public et Auth

- RSVP et messages passent par les API avec validation, origine et limitation de débit ; les saisies valides restent bloquées sur le serveur actuel tant que les RPC manquent.
- Les accès directs anon/authenticated aux tables métier sont volontairement fermés. Le frontend de production utilise les API pour ces fonctionnalités ; son unique lecture directe nécessaire est son propre rôle staff, conservée.
- Le helper de diagnostic frontend testSupabase effectue encore une lecture directe d’albums : ce contrôle historique doit être interprété comme interdit après activation, il ne constitue pas le parcours galerie.
- L’authentification Supabase, la déconnexion et les utilisateurs Auth ne sont pas modifiés. Les vrais parcours avec un compte photographe restent à tester après activation autorisée.
- Le bucket reste privé. Le serveur émet des URL signées après contrôle de publication ; les visiteurs ne reçoivent ni clé serveur ni storage_path dans les réponses finales.

## 4. Contrôles bloquants ajoutés

L’assemblage 001+002 utilise une seule transaction, un verrou consultatif commun au rollback, lock_timeout de 5 secondes et statement_timeout de 120 secondes. Les six tables sont verrouillées en SHARE ROW EXCLUSIVE pendant l’opération : les lectures restent possibles, les écritures attendent. Une fenêtre calme et l’arrêt des écrivains restent nécessaires. L’expiration d’un délai annule la transaction ; elle n’autorise aucune activation partielle.

Avant les créations supplémentaires : types des 31 colonnes, réglage singleton/date, maintien de RLS, définition/validation exacte des 20 contraintes exportées, capacité des champs texte et attributs des rôles et absence d’appartenance à un propriétaire/rôle privilégié, même sans héritage automatique. Une dérive de FK/unique, un champ trop court ou CREATE accordé à un rôle navigateur arrête la migration. La politique staff et les privilèges effectifs après révocation sont contrôlés avant COMMIT.

Les colonnes, contraintes et fonctions actuellement hébergées ne doivent néanmoins pas être supposées identiques à des exports anciens. Les objets réservés déjà présents, les triggers, propriétaires, grantors et index homonymes doivent être confrontés à l’instantané complet avant autorisation finale.

## 5. Sauvegarde réellement effectuée et limite restante

Une **archive REST supplémentaire réelle** des six tables et des métadonnées du bucket a été effectuée en lecture seule, avec pagination, vérification des comptes avant/après, unicité des identifiants et relecture SHA-256 du fichier. Elle est stockée exclusivement dans `.qa-artifacts/backups/`, ignoré par Git et maintenant refusé explicitement par le serveur local et Vite.

Contenu constaté : 3 albums, 1 réglage, 1 membre staff, 0 photo, 0 RSVP, 0 message. Le bucket est privé ; ses limites MIME/taille sont nulles. Aucun contenu personnel ni jeton n’est inclus dans le présent rapport. La preuve sans données figure dans `docs/audit/activation-backup.json`.

**Cette archive REST n’est pas un instantané transactionnel PostgreSQL, ni une sauvegarde complète du projet Supabase.** Elle ne contient pas les définitions/grants complets des fonctions, les ACL SQL, les comptes Auth ni les octets Storage ; les comptes stables ne prouvent pas l’absence de modifications concurrentes conservant le même nombre de lignes. Elle ne suffit donc pas à autoriser l’activation ou à générer le rollback de production.

Le script `preflight-backup-readonly.sql`, généré et testé, produit en une transaction REPEATABLE READ READ ONLY un JSON complet comprenant données métier, empreintes, propriétaires, ACL/grantors/options de délégation par table et colonne, fonctions ciblées et définitions, RLS/politiques, contraintes/triggers/index, rôles/appartenances, droits par défaut, schémas et métadonnées Storage. `SET LOCAL row_security=off` y force une erreur si RLS filtrerait la sauvegarde ; il ne désactive aucune politique ou protection de table.

**Accès SQL non achevé :** aucun connecteur SQL direct ni variable de connexion PostgreSQL n’est disponible dans cette session. psql et pg_dump sont bien installés, mais sans connexion configurée ; leur seule présence ne donne pas accès à Supabase. L’éditeur Supabase est bien ouvert dans Opera, mais Computer Use s’est arrêté car l’URL Windows n’a pas pu être établie avec assez de confiance pour appliquer ses règles. Aucun SQL n’y a été saisi ni exécuté. Cette limite ne permet pas de prétendre que l’instantané SQL réel ou une restauration hébergée a été validé.

Le résultat devra être enregistré intégralement dans un fichier JSON privé du dossier ignoré, jamais dans un chat ou dans Git. Une copie externe protégée est recommandée : les modes de fichier Node et Git ignore ne sont pas un chiffrement ou une garantie d’ACL Windows. Vérifier également une sauvegarde PostgreSQL/PITR restaurable si une récupération complète du projet est exigée ; sa disponibilité n’a pas été constatée ici.

## 6. Retour arrière préparé et éprouvé

`rollback-serverless.sql` est volontairement un **garde-fou non exécutable sans instantané** : il lève une erreur au lieu de rétablir des grants supposés. Le générateur `scripts/prepare-activation-rollback.mjs` produit le vrai SQL à partir du JSON complet :

```powershell
npm run prepare:rollback -- ".qa-artifacts/backups/preactivation.json"
```

Le fichier résultant est privé, sous `.qa-artifacts/backups/rollback-serverless-<timestamp>.sql`. La commande ne contacte aucune base et n’exécute aucun SQL. Ne fournir qu’un instantané de confiance provenant du script de capture.

Le rollback est atomique et restaure les droits directs et par colonne avec options de délégation, les anciennes définitions/ACL des fonctions ciblées, les paramètres RLS précédents compatibles et les index/objets ajoutés. Les politiques existantes ne sont pas réécrites. Il ne réinsère pas une ancienne copie des données : les nouvelles lignes métier sont conservées. Aucun DROP CASCADE ni suppression métier n’est utilisé.

Garde-fous testés : absence de sauvegarde, autre base/exécuteur, dérive d’une fonction/politique/colonne/contrainte/trigger, propriétaire inattendu, RLS désactivé dans la référence, chaîne de délégation non prise en charge ou données de coordination nouvelles. Dans ces cas, le rollback refuse et ne laisse pas d’effet partiel. Une chaîne de grants émise par un autre grantor requiert une analyse dédiée, pas une reconstruction approximative.

**Limite opérationnelle :** dès que les nouvelles tables de coordination contiennent des compteurs ou intentions d’import, leur suppression automatique est refusée. Il faut alors un nouveau plan préservant ces données ; ne pas vider les tables pour contourner le garde-fou. Le rollback rétablit aussi les permissions antérieures potentiellement trop larges : il ne faut pas rouvrir les accès publics sans reprendre les risques préexistants. Coordonner la version de l’application avec celle du schéma.

## 7. Résultats et risques résiduels

| Vérification exécutée | Résultat |
| --- | --- |
| Suite complète npm test | 7 tests historiques, 59 tests API/SQL/runtime, 7 assertions de défilement réussis ; contexte isolé pour les mutations. |
| Audit final ciblé | 15 tests finaux réussis (dont capture SQL et concordance des sources) ; inclut générateurs, restauration ACL et sécurité RLS. Chevauche partiellement la suite complète. |
| Conservation de données | Comparaison des six tables toutes peuplées avant/après deux activations : identique. |
| Rollback | Restauration des ACL/options, ancienne fonction SECURITY DEFINER/ACL, index/RLS ; conservation de nouvelles lignes métier ; refus atomique en cas de dérive/données de coordination. |
| TypeScript / lint / build / secrets | Réussis ; 16 contrôles HTTP réussis. verify:runtime retourne encore 1 à cause de schema_required, sans erreur de passerelle. |
| Read-only Supabase réel | Tables disponibles et archive supplémentaire relue ; bucket privé confirmé. Aucune mutation réelle. |
| SQL hébergé / compte photographe / import réel | Non exécutés, pas déclarés validés. |

Risques restant à traiter avant exécution :

1. **Bloquant :** instantané SQL réel complet et rollback spécifique non générés. Les exports incomplets et l’archive REST ne les remplacent pas.
2. **Disponibilité :** verrous et construction d’index peuvent bloquer des écritures ; la durée réelle dépend de la taille et de la charge. Pause des écrivains, délais bornés et fenêtre calme nécessaires.
3. **Droits historiques :** la révocation peut interrompre un consommateur extérieur lisant directement les tables métier ; aucun usage externe non fourni ne peut être certifié.
4. **Storage inchangé :** limites taille/MIME nulles ; URL signées de lecture réutilisables jusqu’à 600 secondes après masquage, jetons d’import jusqu’à deux heures. Aucun durcissement Storage n’est inclus dans l’autorisation envisagée.
5. **Validation fonctionnelle distante :** vrais JWT/roles, RSVP/billet/message et transfert/finalisation doivent être testés dans un cadre autorisé après activation ; les fixtures ne les remplacent pas.

## 8. Séquence avant toute confirmation finale

- Capturer l’instantané SQL en lecture seule, complet et récent, et vérifier sa conservation privée et sa lisibilité.
- Examiner les rôles/grantors, objets homonymes, triggers, propriétaires, défauts, contraintes, politiques et droits hérités de cet instantané ; arrêter si une dérive n’est pas prise en charge.
- Générer le rollback réel, le contrôler et répéter activation/retour arrière sur un environnement isolé reproduisant ces métadonnées ; protéger la sauvegarde des données.
- Présenter les empreintes SQL finales, la fenêtre d’intervention et les réserves restantes ; recueillir votre **confirmation finale distincte**.
- Seulement ensuite appliquer le SQL autorisé, puis contrôler la conservation des données et lancer verify/essais fonctionnels autorisés. Aucun push ni déploiement automatique.

Les empreintes des fichiers finaux et les résultats sans données privées figurent dans `docs/audit/activation-security.json`.

La commande locale `npm run audit:activation` rassemble les tests de cet audit. Elle n’exécute aucune migration hébergée.

Références primaires : [CREATE FUNCTION et privilèges](https://www.postgresql.org/docs/current/sql-createfunction.html), [résolution des schémas](https://www.postgresql.org/docs/15/ddl-schemas.html), [sauvegardes cohérentes et RLS](https://www.postgresql.org/docs/current/app-pgdump.html). Les constats sur le projet proviennent du code, des exports, des requêtes réelles en lecture seule et des tests décrits ; les exceptions non observées ne sont pas présentées comme vérifiées.
