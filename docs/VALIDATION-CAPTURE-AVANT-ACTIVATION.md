# Validation de la capture réelle avant activation — Alicia & Jeff

14 novembre 2026, UTC. Projet configuré : `mcnpagbcehupdbhshcea`.

**Précontrôles techniques validés. Activation non exécutée et autorisation finale toujours requise.** Aucun changement de `.env.local`, de permission hébergée, de bucket, de données réelles, aucun push ou déploiement.

## Capture reçue et vérifiée

La capture privée `preactivation.json`, datée du **14 novembre 2026 à 16:39:26 UTC**, est complète et lisible. Son empreinte SHA-256 est :
`2d3744623c280a02f081c392676bc2cb87326671aa47c3d23fe5508a05df62d3`.

Le serveur déclare PostgreSQL **17.11**, base et exécuteur `postgres`. La capture contient les **six tables, 33 colonnes, 20 contraintes, 13 index**, leurs propriétaires, ACL/droits par colonne, politiques, rôles/appartenances et droits par défaut. Aucune des vingt fonctions cibles ou des deux tables de coordination n’existe encore ; aucun trigger métier supplémentaire n’est présent. Les vingt contraintes correspondent aux exports audités, dont les trois clés étrangères.

| Table | Lignes conservées dans la capture | Propriétaire | RLS |
| --- | --- | --- | --- |
| wedding_albums | 3 | postgres | Activé |
| wedding_photos | 0 | postgres | Activé |
| wedding_settings | 1 | postgres | Activé |
| wedding_staff | 1 | postgres | Activé |
| wedding_rsvps | 0 | postgres | Activé |
| wedding_messages | 0 | postgres | Activé |

Une relecture réelle du projet configuré, **en lecture seule le 14 novembre à 16:55 UTC**, confirme les six empreintes de contenu, pas seulement les comptes. Le bucket wedding-photos reste privé et ses limites MIME/taille sont nulles. Cette relecture REST n’est pas elle-même une transaction ; il faut maintenir les écrivains arrêtés pendant l’intervention. Les permissions sont validées depuis l’instantané SQL reçu.

## Permissions, politiques et dépendances

Les **17 contrôles de revue** passent. Preuve sans données personnelles : `docs/audit/preactivation-review.json`.

- Les rôles anon/authenticated sont sans login, superuser, BYPASSRLS, CREATEROLE ou CREATEDB. Ils ne sont membres d’aucun autre rôle et n’ont pas CREATE sur public. Les six tables appartiennent à postgres.
- postgres est **non superutilisateur**, avec BYPASSRLS ; service_role possède BYPASSRLS. L’usage de la clé serveur reste exclusivement backend.
- Les trois politiques métier correspondent à l’attendu : albums publiés, photos visibles d’albums publiés, et lecture de son propre rôle staff. Cette dernière sera conservée avec SELECT(user_id,role).
- Les droits SQL actuels sont trop larges sur albums/photos/settings/staff : anon/authenticated ont notamment TRUNCATE et MAINTAIN. RLS ne rend pas sûrs les droits de table entière ; cela ne démontre pas à lui seul un endpoint distant exploitable. La migration 002 les révoque sans ajouter de politique permissive.
- RSVP/messages n’ont actuellement aucun grant direct aux deux rôles visiteurs. La migration conserve le passage par les API, plutôt que d’ouvrir les tables.
- Les deux tables Storage ont RLS, aucun filtre de politique, et un propriétaire distinct des visiteurs. Avec les attributs de rôles effectivement capturés et sans appartenance héritée, le modèle reste le refus par défaut pour les lignes ordinaires. Les grants SQL de lignes ne sont pas assimilés à une autorisation RLS. Aucun grant/politique Storage ne sera changé.
- Les droits par défaut du schéma public donnent des droits aux visiteurs sur les nouveaux objets. La répétition les reproduit et vérifie que l’activation retire bien les accès aux fonctions et tables de coordination créées.
- Les vingt fonctions créées sont explicitement SECURITY INVOKER, search_path pg_catalog,pg_temp, EXECUTE serveur/propriétaire uniquement. La boucle vise les signatures exactes ; aucune autre fonction/surcharge n’est affectée.

Les contraintes existantes ne seront pas changées : les FK photos→albums, staff→Auth et messages→RSVP conservent leur comportement. Les deux nouvelles tables restent privées, avec leur propre FK restrictive d’album. Les trois index explicitement ajoutés sont distincts des index automatiques des nouvelles clés/uniques. Aucun contenu métier n’est modifié par l’activation.

## Rollback réel généré

Fichier privé exact, à conserver hors Git :
`C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3\.qa-artifacts\backups\rollback-serverless-1794674648187.sql`

SHA-256 :
`72341c26e95082760a5519d297838243301d181f915cc9b69cfae5a010528117`.

Le fichier suivi dans Git `supabase/activation/rollback-serverless.sql` reste un simple garde-fou. Le fichier privé ci-dessus est celui produit à partir des **permissions réelles** de la capture. Son garde-fou exige la base et le rôle postgres. Le fichier n’a pas été exécuté sur Supabase.

La répétition locale reconstruit exactement les données privées et les métadonnées des six tables, y compris ACL avec MAINTAIN, grants/options, colonnes/défauts, contraintes, politiques et treize index. Elle utilise un rôle postgres distinct du bootstrap du moteur, ensuite non superutilisateur avec BYPASSRLS, pour ne pas masquer des erreurs par un privilège supplémentaire.

Résultats :

1. Données et six empreintes de la capture reproduites exactement ; métadonnées/ACL/index métier conformes à la capture.
2. Activation exécutée deux fois hors ligne : idempotence et conservation complète du contenu.
3. Les neuf contrôles SQL Editor après activation sont vrais : fonctions, invoker/search_path, EXECUTE, RLS, accès navigateur, lookup staff, droits serveur, index et bucket privé de la fixture.
4. Retour arrière : permissions/options, RLS/politiques, index et fonctions rétablis ; données privées inchangées ; valeurs par défaut, métadonnées Storage locales et appartenances de rôle inchangées.
5. Les nouvelles tables de coordination ne sont retirées que lorsqu’elles sont vides. Le générateur refuse les situations entraînant une perte de ces données.

Preuve : `docs/audit/preactivation-rehearsal.json`. Le script local reproductible est `scripts/rehearse-activation-snapshot.mjs`. Il utilise uniquement le moteur PostgreSQL embarqué, sans connexion Supabase. La dernière relecture distante distincte se trouve dans `docs/audit/preactivation-current-readonly.json`.

### Limites de la répétition

Le moteur embarqué est PostgreSQL **17.5**, pas un serveur Supabase 17.11 complet. Auth et Storage sont des fixtures locales pour leurs dépendances ; leurs services hébergés et capacités signées ne sont pas déclarés testés.

La version installée de PGlite utilise la base template1 malgré son option database. Le fichier original de rollback a d’abord été testé tel quel : son garde-fou a correctement refusé cette autre base. Pour répéter le reste, **seul le littéral du nom de base a été adapté en mémoire** à template1. Le rôle, les autres garde-fous, les permissions et les instructions de restauration sont inchangés. Le fichier privé destiné à Supabase conserve bien postgres et son empreinte d’origine. Cette adaptation est enregistrée dans la preuve ; aucun affaiblissement n’est appliqué au script de production.

## Version proposée et risques résiduels à accepter

Fichier : `supabase/activation/activate-serverless.sql`.
SHA-256 après normalisation CRLF→LF :
`0f3799c3b3339ecff83463df8e8960e1e6141e3a12d0b380cf273983d5a7d1e0`.

**Le SQL d’activation est inchangé depuis l’audit préalable.** Il regroupe 001+002 dans une transaction : vingt fonctions, deux tables privées, trois index explicites et restriction des droits métier. Il ne modifie ni les six jeux de données existants, ni Auth, ni Storage, ni les secrets.

Restent ces limites d’intervention :

- Verrouillage/construction d’index : choisir une fenêtre calme et arrêter les écrivains. Attente de verrou bornée à 5 secondes, chaque instruction bornée à 120 secondes. Une erreur n’autorise pas à supprimer les précontrôles.
- Les accès directs aux tables métier seront retirés. Un consommateur externe non fourni pourrait être interrompu ; le frontend audité utilise les API et conserve la lecture de son propre rôle.
- Un rollback tardif refuse de supprimer les données de coordination et peut nécessiter un nouveau plan de conservation. Il rétablit aussi les permissions anciennes, plus larges : il ne faut pas rouvrir aveuglément les accès.
- Les limites MIME/taille du bucket et les TTL des URL signées restent inchangés. Aucun durcissement Storage n’est inclus dans cette activation.
- Les véritables parcours JWT/photographe, RSVP/billet, message, upload et publication restent à valider après activation autorisée, dans un contexte d’essai approprié. Le succès hors ligne ne signifie pas que le service hébergé est déjà opérationnel.

Toute modification de schéma, permission ou contenu après la capture remet en question ce bilan ; elle impose une nouvelle comparaison et, si nécessaire, une nouvelle capture/rollback. Le privilège CREATE du compte postgres sur le schéma cible dépend également de la configuration de la base réelle ; toute absence de droit provoquera un échec transactionnel, sans ajout automatique de grant pour contourner le problème.

## Étape suivante — attendre la confirmation finale

Après votre accord explicite pour **cette version et ce projet**, vous pourrez suivre la phase 3 de `docs/PROCEDURE-SUPABASE-SQL-EDITOR.md` : nouvelle requête, rôle postgres, totalité de activate-serverless.sql, Run une fois. Exécuter ensuite le contrôle verify-serverless-readonly.sql et enregistrer son export JSON privé sous `.qa-artifacts/backups/postactivation-verification.json` pour comparaison des empreintes.

Aucune opération d’activation ou de rollback hébergé n’est lancée par la préparation de ce bilan. L’accord de principe précédent et le dépôt du fichier de capture ne sont pas interprétés comme une autorisation finale.
