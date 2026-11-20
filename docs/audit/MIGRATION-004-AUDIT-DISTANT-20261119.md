# Alicia & Jeff — audit distant de la migration 004

Contrôle du 19 novembre 2026, projet Supabase `mcnpagbcehupdbhshcea`.
Précontrôles et sauvegarde : 11:33 UTC. Aucun SQL d’écriture exécuté.

## Connexion réellement utilisée

La connexion utilisateur existante `supabase_alicia_jeff_readonly` a été conservée sans modification.
URL : `https://mcp.supabase.com/mcp?project_ref=mcnpagbcehupdbhshcea&read_only=true&features=database`.

Le registre de la conversation historique reste incomplet. Le diagnostic a abouti avec le client officiel `codex app-server --stdio`, dans un contexte éphémère (`ephemeral=true`, chemin d’historique nul), sans appel au modèle, sans reprise forcée du contexte verrouillé et sans nouvelle connexion OAuth.

Résultat réel : `runtimeStatus=connected`, `authStatus=oAuth`, serveur `supabase` version `0.17.0`, `toolsError=null`.
Outils réellement découverts : `list_tables`, `list_migrations`, `list_extensions`, `execute_sql`.
Seuls les trois outils de lecture nécessaires ont été appelés. Aucun outil de migration n’est disponible sur cette connexion.

Les SELECT ont été exécutés sous `supabase_read_only_user`, avec `transaction_read_only=on`. Les paramètres `project_id` ne sont pas requis : le serveur est déjà limité au projet.

## Tables présentes dans public

| Table | RLS | Lignes indicatives remontées par list_tables |
| --- | --- | ---: |
| wedding_albums | activé | 3 |
| wedding_photos | activé | 7 |
| wedding_settings | activé | 1 |
| wedding_staff | activé | 1 |
| wedding_rsvps | activé | 3 |
| wedding_messages | activé | 2 |
| wedding_api_limits | activé | 7 |
| wedding_api_uploads | activé | 7 |

Les effectifs des six tables métier ont ensuite été confirmés par la sauvegarde SELECT. Les deux tables de coordination n’ont pas été exportées en données : seule leur structure est sauvegardée.

## Historique des migrations et état de 004

`list_migrations` retourne exactement `{"migrations":[]}`.
`supabase_migrations.schema_migrations` n’existe pas.

Cela signifie qu’aucun historique n’est enregistré dans ce mécanisme. Cela ne prouve pas que les scripts historiques 001/002 n’ont jamais été exécutés : huit tables et vingt fonctions métier sont bien présentes. Ne pas recréer ces tables, ni lancer globalement toutes les migrations locales.

Contrôle direct des catalogues pour 004 :
- `public.wedding_ticket_entries` : absente ;
- `public.wedding_api_confirm(jsonb,text)` : absente ;
- `public.wedding_api_ticket_restore(text,text)` : absente ;
- `public.wedding_api_ticket_lookup(text)` : absente ;
- `public.wedding_api_ticket_enter(text,timestamptz,text)` : absente ;
- aucun autre overload public de ces quatre noms n’a été trouvé.

Conclusion : les objets attendus de la migration 004 ne sont pas installés. Il ne s’agit pas seulement d’un numéro manquant dans l’historique. Aucune trace de son installation partielle n’a été trouvée pour ces objets.

## Comparaison au fichier local

Fichier approuvé, laissé intact : `supabase/migrations/004_ticket_entry.sql`.
SHA-256 vérifié :
`6308483d162d805f019b607335f128446251e8eec33392102a0c25fe99ab53cf`.

La différence distante est l’absence de la table et des quatre fonctions prévues. Les contraintes, politiques et permissions de ces objets n’existent donc pas encore et ne peuvent pas être présentées comme validées après installation.

Compatibilité des dépendances vérifiée :
- `wedding_rsvps.id` est un UUID avec clé primaire ;
- `ref_hash` est unique ;
- `ref_hash varchar(64)`, `first_name varchar(80)` et `last_name varchar(80)` sont compatibles avec les opérations texte de 004 ;
- `created_at` et `updated_at` sont des timestamps avec fuseau ;
- les fonctions existantes `wedding_api_rsvp(jsonb)` et `wedding_api_rate(text,integer,integer)` sont présentes.

La compilation des nouvelles fonctions et les tests d’admission restent à effectuer après l’application autorisée. Aucun test fonctionnel écrivant des données n’a été effectué sur la production pendant cet audit.

## Sécurité et RLS

Constats distants :
- RLS est activé sur les huit tables publiques ;
- `anon` et `authenticated` n’ont pas CREATE sur le schéma public ;
- `service_role` dispose de BYPASSRLS, comme le requiert l’architecture serveur ;
- les vingt fonctions historiques sont SECURITY INVOKER, avec `search_path=pg_catalog, pg_temp` ;
- aucun EXECUTE via PUBLIC, anon ou authenticated sur ces vingt fonctions ; service_role peut les appeler ;
- aucun droit SQL global de table des rôles navigateur n’a été trouvé sur les tables sauvegardées ;
- exception intentionnelle au niveau colonne : authenticated peut lire uniquement `wedding_staff.user_id` et `role`, avec une politique SELECT imposant `user_id = auth.uid()` ;
- les politiques de lecture des albums et photos publiés existent, mais leur existence ne confère pas à elle seule un droit SQL de lecture.

RLS et les permissions SQL ont été examinés séparément. Le rôle d’audit peut lire les données pour la sauvegarde ; cela ne représente pas les permissions de anon/authenticated. Aucun ALTER RLS ni SET row_security=off n’a été exécuté.

Garanties prévues dans le SQL 004, à contrôler réellement après installation :
- table privée avec RLS, sans politique autorisant les navigateurs ;
- suppression des droits PUBLIC/anon/authenticated, y compris des droits de colonne ;
- SELECT/INSERT/UPDATE pour service_role ;
- quatre fonctions SECURITY INVOKER, search_path fixé, EXECUTE réservé à service_role ;
- clé étrangère RSVP avec ON DELETE RESTRICT, jeton unique et contrôle de format, unicité du nom admis et enregistrement d’entrée sous verrous.

## Sauvegarde ciblée et rollback

Sauvegarde créée via un seul SELECT cohérent, sans les commandes de transaction ou SET du script source :
`.qa-artifacts/mcp-migration004-20261119/pre004-snapshot-private.json`.

Contenu : schémas, contraintes, ACL, politiques et métadonnées de huit tables ; définitions et ACL des vingt fonctions ; données des six tables métier, soit 17 lignes ; métadonnées nécessaires à l’audit. Aucun objet Auth ni fichier Storage n’a été exporté. Il s’agit d’une sauvegarde logique ciblée, pas d’une sauvegarde intégrale de la plateforme.

SHA-256 de la sauvegarde :
`31eff939f62f4dc5203ff7f22c7fd7f2c76a0b02429ecde412eed6db12758d71`.

Le JSON est lisible, son empreinte a été vérifiée, et le dossier est ignoré par Git. Les données personnelles n’ont pas été affichées dans le chat. Rafraîchir cette sauvegarde avant une intervention ultérieure si des données ont évolué.

Rollback existant, vérifié et non exécuté :
`supabase/activation/rollback-ticket-entry.sql`.
SHA-256 : `a67d83a3096d39f8578077835d7bb007c5e3056bd1b76abc54d631143db15d73`.

Ce rollback désactive les nouveaux accès serveur sans supprimer table, jetons, confirmations ou preuves d’entrée. Il ne reconstitue pas automatiquement une version applicative antérieure. Les vingt fonctions historiques restent inchangées.

## Préparation de l’application, sans exécution

L’autorisation déjà donnée pour 004 est conservée. La connexion actuelle doit rester en lecture seule.

Deux voies ont été distinguées :
1. SQL Editor avec un compte disposant des droits nécessaires : le fichier original approuvé peut être exécuté exactement, avec sa transaction explicite. Cette voie ne crée pas automatiquement un historique de migrations ; consigner sa preuve et vérifier les objets.
2. Un gestionnaire de migrations, notamment MCP apply_migration : éviter d’imbriquer le BEGIN/COMMIT du fichier dans la transaction du runner. Une variante locale `supabase/activation/004_ticket_entry.mcp-runner.prepared.sql` a été préparée en retirant uniquement ces deux lignes. Son équivalence de corps SQL est vérifiée ; l’original n’a pas été modifié. Cette variante a une empreinte différente et n’a pas été transmise ni exécutée. Votre consigne antérieure interdisant l’exécution d’un contenu différent impose de valider cette adaptation avant de l’utiliser à distance.

Le modèle local `supabase/activation/mcp-migration004.config.example.toml` décrit une connexion d’intervention distincte, désactivée par défaut, limitée au même projet et au groupe database. Il n’a pas été installé dans la configuration Codex. L’accès OAuth en écriture et les outils réellement exposés devront être vérifiés au moment nécessaire, sans demander de clé dans le chat.

Documentation Supabase sur les transactions imbriquées :
https://supabase.com/kb/troubleshooting/partial-migrations-and-schema-inconsistencies-from-embedded-transactions-13ae82

## Contrôles obligatoires au moment de l’intervention

1. Recontrôler projet, SHA du fichier choisi, absence de wedding_ticket_entries et des quatre noms de fonctions, puis rafraîchir la sauvegarde.
2. Arrêter si des objets de 004 apparaissent ou si le contenu a changé ; ne pas rejouer une migration déjà installée et ne pas reconstruire les scripts historiques à partir d’un historique vide.
3. Vérifier la connexion d’écriture, la portée et les permissions. Ne pas transformer la connexion de diagnostic en connexion d’écriture.
4. Exécuter uniquement le contenu approuvé, par la voie retenue, dans sa transaction adaptée.
5. Relire les colonnes, contraintes prévues, FK, RLS, ACL de table et de colonne, paramètres et droits EXECUTE des quatre fonctions, ainsi que les vingt fonctions historiques et les empreintes des six tables métier.
6. Comparer les données avant de lancer des tests fonctionnels ; distinguer une activité légitime concurrente d’une modification causée par l’intervention. Ne pas déclencher automatiquement un rollback destructif.
7. Tester ensuite le parcours RSVP/billet et les admissions dans un environnement de test approprié. Les identifiants Google Sheets et la configuration applicative doivent être vérifiés séparément ; cet audit ne les valide pas.

Aucune migration, écriture distante, modification de secret, de configuration de production, de Storage ou d’Auth, aucun push GitHub et aucun déploiement Vercel n’a été effectué.

## Vérifications locales de la préparation

- SHA-256 de l'original : conforme à l'empreinte autorisée, fichier inchangé.
- Variante runner : seules les lignes externes BEGIN et COMMIT ont été retirées ; équivalence du corps SQL vérifiée automatiquement.
- SHA-256 de la variante : 25ea91124345bd646c7a242db3c1ee53c51be5dcafe3629a7d1112e27339f233.
- Sauvegarde JSON : parsable, schéma de huit tables, vingt fonctions et six ensembles de données présents ; SHA vérifié.
- Dossier de sauvegarde : exclusion Git confirmée par git check-ignore.
- npm run check:secrets : réussi, sept artefacts frontend examinés, aucune clé Supabase privilégiée détectée. Ce contrôle ne constitue pas un test fonctionnel des futurs RPC.
- Aucune compilation distante des quatre nouvelles fonctions et aucun test d'entrée réel : ces fonctions sont absentes et le diagnostic reste en lecture seule.
