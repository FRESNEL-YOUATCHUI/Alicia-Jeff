# Alicia & Jeff — exécution de la migration 004

Projet : `mcnpagbcehupdbhshcea`. Intervention du 19 novembre 2026.
**État final : migration appliquée et vérifiée. Aucun rollback de migration exécuté.**

## 1. Périmètre et autorisation

L’autorisation explicite reçue couvre la variante destinée au runner, sous réserve que seules les délimitations transactionnelles externes soient retirées. Cette condition a été vérifiée par comparaison exacte des chaînes et par empreintes.

- Original inchangé : `supabase/migrations/004_ticket_entry.sql`.
- SHA-256 original : `6308483d162d805f019b607335f128446251e8eec33392102a0c25fe99ab53cf`.
- Contenu appliqué : `supabase/activation/004_ticket_entry.mcp-runner.prepared.sql`.
- SHA-256 appliqué : `25ea91124345bd646c7a242db3c1ee53c51be5dcafe3629a7d1112e27339f233`.
- Seules les deux lignes externes BEGIN et COMMIT ont été supprimées. Les blocs PL/pgSQL et tout le corps métier sont inchangés.

La connexion OAuth d’intervention a été limitée à ce projet et au groupe database. Les scopes demandés lors du consentement final étaient `projects:read`, `database:read`, `database:write`. La demande initiale automatique plus large a été arrêtée avant son autorisation. Aucune clé ni aucun secret n’a été demandé dans le chat.

## 2. Sauvegarde et précontrôles

La sauvegarde précédente a été vérifiée, puis une nouvelle capture cohérente a été créée à 20:29:20 UTC :
`.qa-artifacts/mcp-migration004-application-20261119/pre004-snapshot-private.json`.

SHA-256 :
`53ba609c3278dec00e34f10f762795f74aa452e25bcb99a092b30dbc0a7e3c55`.

La sauvegarde est un JSON exploitable comprenant la structure et la sécurité des huit tables préexistantes, vingt fonctions historiques et les données des six tables métier. Effectifs : albums 3, photos 7, settings 1, staff 1, RSVP 3, messages 2. Elle ne constitue pas une sauvegarde intégrale d’Auth ou des fichiers Storage.

Le fichier et les autres captures privées sont exclus de Git. Les données personnelles n’ont pas été affichées dans le chat. Leurs empreintes, structures, ACL et fonctions ont été comparées de nouveau immédiatement avant l’application : aucun écart.

Rollback vérifié : `supabase/activation/rollback-ticket-entry.sql`.
SHA-256 : `a67d83a3096d39f8578077835d7bb007c5e3056bd1b76abc54d631143db15d73`.
Il vise exclusivement les droits service_role des quatre nouvelles fonctions et de la nouvelle table ; il ne supprime aucune donnée et conserve les preuves d’entrée. Il n’a pas été exécuté.

Juste avant l’application :
- table wedding_ticket_entries absente ;
- aucun overload public des quatre noms de fonctions de 004 ;
- aucune migration ticket_entry/004 déjà enregistrée ;
- schéma, dépendances, RLS et droits de création conformes ;
- exécuteur d’intervention postgres, transaction_read_only=off ;
- URL et référence du projet strictement vérifiées ;
- empreintes des données et objets historiques identiques à la sauvegarde.

## 3. Application réalisée

Un seul appel `apply_migration` a été effectué, à partir des outils réellement découverts sur le serveur Supabase 0.17.0.

| Élément | Résultat |
| --- | --- |
| Nom enregistré | ticket_entry_004 |
| Version Supabase | 20261119203629 |
| Réponse de apply_migration | success: true |
| Anciennes migrations rejouées | aucune |
| Nouvelle tentative après application | aucune |
| Rollback automatique | aucun |

Le runner a enregistré la migration dans l’historique. L’historique auparavant vide n’a pas été utilisé pour rejouer les scripts historiques.

## 4. Vérifications immédiates

Table créée : `public.wedding_ticket_entries`, propriétaire postgres, RLS activé, aucune politique de lecture publique, aucun privilège PUBLIC.

Colonnes : rsvp_id UUID non nul ; token text non nul ; checked_in_at timestamptz nullable ; admitted_name_hash text nullable ; created_at timestamptz non nul, valeur par défaut now().

Sept contraintes validées :
- clé primaire sur rsvp_id ;
- clé étrangère vers wedding_rsvps(id), ON DELETE RESTRICT ;
- unicité de token ;
- unicité de admitted_name_hash ;
- format du jeton ;
- format du hash du nom ;
- cohérence checked_in_at / admitted_name_hash.

Fonctions présentes, signatures et corps comparés au SQL autorisé :
- wedding_api_confirm(jsonb,text) ;
- wedding_api_ticket_restore(text,text) ;
- wedding_api_ticket_lookup(text) ;
- wedding_api_ticket_enter(text,timestamptz,text).

Les quatre fonctions sont SECURITY INVOKER, retournent jsonb et fixent search_path à pg_catalog, pg_temp. EXECUTE est refusé à PUBLIC, anon et authenticated et autorisé à service_role. Aucun accès de table ou de colonne n’est accordé à anon/authenticated sur les billets.

Point de privilèges à conserver dans le suivi : service_role hérite des droits étendus par défaut, y compris DELETE, TRUNCATE, REFERENCES et TRIGGER, en plus de SELECT/INSERT/UPDATE. Le SQL 004 autorisé ne révoque pas ces droits de ce rôle serveur de confiance. Aucun durcissement supplémentaire non autorisé n’a été effectué.

Les huit tables historiques, leurs colonnes, ACL, politiques, index, les vingt fonctions historiques, les données métier, les ACL de schémas et les métadonnées Storage comparées sont inchangés.

## 5. Tests contrôlés exécutés

Les tests utilisent les vrais RPC installés. Les appels sont réalisés sous les rôles anon, authenticated puis service_role dans une transaction explicitement terminée par ROLLBACK.

Deux confirmations RSVP réelles déjà présentes ont servi uniquement à créer des billets temporaires dans cette transaction. Aucun invité fictif n’a été créé, aucune ligne RSVP n’a été modifiée, aucune admission de test n’a été conservée.

| Cas | Résultat |
| --- | --- |
| anon : lecture directe des billets refusée | réussi |
| anon : appel RPC refusé | réussi |
| authenticated : lecture directe refusée | réussi |
| authenticated : appel RPC refusé | réussi |
| confirmation avec accompagnant refusée | réussi, AJ400 |
| restauration avec format invalide refusée | réussi, AJ400 |
| restauration d’une référence inconnue refusée | réussi, AJ404 |
| recherche d’un billet inconnu | réussi, NULL |
| entrée avec format invalide refusée | réussi, AJ400 |
| entrée avec jeton inconnu | réussi, unknown |
| restauration d’un billet pour un RSVP réel | réussi |
| restauration répétée sans nouveau billet | réussi |
| recherche du billet restauré | réussi |
| version RSVP périmée | réussi, changed |
| contrainte de format du jeton | réussi |
| contrainte de cohérence date/hash d’entrée | réussi |
| première entrée | réussi, valid |
| nouvelle lecture du même billet | réussi, used |
| second billet avec le même hash de nom | réussi, name_already_entered |
| confirmations RSVP inchangées | réussi |

Vingt cas passent. Après annulation de la transaction : zéro billet avant et après, empreinte des billets identique, données et objets historiques identiques. La connexion SQL reprend son rôle initial.

Limites explicites :
- aucun appel positif à confirm n’a été effectué, car il mettrait à jour une confirmation existante ;
- deux scans simultanés dans des transactions avec billets persistants n’ont pas été simulés sur la production ;
- le navigateur, Google Sheets et le parcours complet de téléchargement/scan ne sont pas validés par ces tests SQL.

## 6. Vérification finale indépendante

La connexion `supabase_alicia_jeff_readonly` a confirmé après les tests :
- transaction_read_only=on ;
- trois RSVP existants ;
- zéro billet de test conservé ;
- neuf tables publiques, toutes avec RLS activé ;
- quatre fonctions de 004 présentes, paramètres de sécurité conformes ;
- migration 20261119203629 / ticket_entry_004 enregistrée.

La connexion locale d’intervention `supabase_alicia_jeff_migration004` a ensuite été désactivée. Sa configuration et son OAuth sont conservés ; aucun logout n’a été effectué. La connexion de lecture seule reste activée et authentifiée.

## 7. Erreurs et état final

Aucune erreur SQL d’application ou de test n’a été rencontrée. Aucun état partiel n’a été détecté.

Une erreur locale de construction du contrôleur JavaScript est survenue pendant sa préparation, avant toute exécution distante. Elle a été corrigée ; le contrôleur a ensuite passé node --check avant son unique exécution.

Le marqueur local d’application et le contrôle d’absence empêchent une réexécution accidentelle. Ne pas rejouer 004 pour « compléter » l’historique ancien.

Aucun secret de projet, objet Auth, fichier Storage ou donnée métier préexistante n’a été modifié. Aucun push GitHub, déploiement Vercel ou rollback de migration n’a été effectué.

La migration est opérationnelle au niveau SQL. Les validations applicatives réelles — notamment Google Sheets, génération du billet et scan depuis le navigateur — restent une étape distincte.

Preuves techniques : `docs/audit/migration004-execution-20261119.json`. Les sauvegardes et journaux détaillés contenant des informations privées restent dans .qa-artifacts.
