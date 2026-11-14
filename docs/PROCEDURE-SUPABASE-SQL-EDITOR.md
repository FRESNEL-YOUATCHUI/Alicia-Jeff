# Supabase SQL Editor — procédure d’activation Alicia & Jeff

> **État courant après activation :** le propriétaire a exécuté le SQL autorisé ; vérification SQL positive, données préservées et `npm run verify` réussi (code 0). Voir [RAPPORT-POST-ACTIVATION.md](RAPPORT-POST-ACTIVATION.md). Les mentions de blocage/attente ci-dessous décrivent les étapes antérieures ; les changements Storage restent non appliqués.

14 novembre 2026, UTC. Projet attendu : **alicia-jeff-wedding**, référence **mcnpagbcehupdbhshcea**.
Dossier local : `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`.

**Aucune opération Supabase n’a été exécutée pour préparer cette procédure. `.env.local` reste inchangé. Ne partagez aucune clé, mot de passe, connexion PostgreSQL ou contenu de sauvegarde dans le chat.**

## Ordre obligatoire

| Phase | Fichier | Effet | Condition |
| --- | --- | --- | --- |
| 1. Capture préalable | `supabase/activation/preflight-backup-readonly.sql` | Lecture seule, instantané cohérent des données et métadonnées. | À réaliser avant toute activation. |
| 2. Analyse et rollback | Export JSON privé et générateur local | Aucun accès ou changement Supabase. | Je vérifie les droits réels et génère le rollback adapté. |
| 3. Activation | `supabase/activation/activate-serverless.sql` | Vingt fonctions, deux tables privées, trois index, permissions métier ; transaction unique. | **Seulement après votre autorisation finale explicite, après validation de la phase 2.** |
| 4. Contrôle | `supabase/activation/verify-serverless-readonly.sql` | Lecture seule, neuf contrôles de sécurité/dépendances et empreintes des six tables. | Après activation autorisée. |

L’activation ne contient pas la migration Storage optionnelle 003 et ne modifie ni bucket, ni compte Auth, ni secret. Les fonctionnalités ne seront pas déclarées opérationnelles avant les contrôles API et les essais réels autorisés.

## 1. Capturer l’état avant activation dans SQL Editor

1. Dans Supabase, ouvrez **alicia-jeff-wedding → SQL Editor → New query**. Vérifiez la référence du projet dans l’URL : `mcnpagbcehupdbhshcea`. N’utilisez pas un autre projet ou une branche de base de données différente.
2. Si l’interface propose le choix de la base/du rôle, utilisez la base principale attendue et **postgres**. Cette capture doit voir toutes les données ; ne la lancez pas en rôle anon ou authenticated.
3. Ouvrez localement le fichier suivant dans VS Code ou Bloc-notes et copiez **tout son contenu** :
   `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3\supabase\activation\preflight-backup-readonly.sql`
4. Dans la nouvelle requête SQL, collez uniquement ce contenu. Laissez le fichier intact, de `begin transaction ... read only` jusqu’à `commit;`. Ne sélectionnez pas un fragment : SQL Editor peut exécuter seulement le texte sélectionné. Cliquez ensuite **Run** pour le script entier.
5. Résultat attendu : une ligne avec une colonne **snapshot**. Le JSON doit contenir `format: "alicia-jeff-preactivation-v1"`, les six tables, leurs données, ACL, contraintes/politiques et empreintes. Si une erreur ou un résultat tronqué apparaît, arrêtez ; n’activez rien. Si aucune colonne snapshot n’apparaît, ne remplacez pas le résultat par une copie partielle affichée dans une cellule.
6. Dans les résultats, utilisez **Export → Copy as JSON**. Collez ce JSON dans un nouveau fichier local, sans le coller dans le chat. Enregistrez-le sous :
   `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3\.qa-artifacts\backups\preactivation.json`
   Utilisez UTF-8 et le type **Tous les fichiers**, pour éviter `preactivation.json.txt`. Conservez le JSON complet, y compris son éventuel tableau extérieur `[ ... ]` et la clé snapshot.
7. Ne copiez pas les données dans le texte d’une requête enregistrée ou partagée. Cette sauvegarde reste dans le dossier ignoré par Git ; ce dossier est également refusé par le serveur web local. Une copie protégée hors du projet est utile ; Git ignore n’est pas un chiffrement.
8. Revenez simplement indiquer **« la capture est enregistrée »**. Je lirai le fichier sur votre ordinateur. Aucun contenu confidentiel n’est demandé dans la réponse.

**Arrêt ici. Ne lancez pas activate-serverless.sql à cette étape.**

Le fichier de capture n’ajoute aucune table, politique ou fonction. `SET LOCAL row_security=off` demande une erreur si une politique risquait de filtrer la sauvegarde ; il ne désactive pas RLS sur les tables. La transaction est REPEATABLE READ READ ONLY. La capture n’est pas une sauvegarde de tous les utilisateurs Auth ni des octets Storage, qui ne sont pas modifiés par cette activation.

## 2. Vérifications que j’effectuerai sur le fichier local

Je confronterai l’instantané réel aux sources auditées : les 31 colonnes utilisées, 20 contraintes et leurs FK/uniques, index homonymes, triggers, propriétaires, rôles/appartenances, droits de schéma, grants directs/par colonne et options de délégation, politiques RLS, éventuelles fonctions existantes et droits EXECUTE.

Je vérifierai notamment :

- RLS activé sur les six tables et politique de lecture de son propre rôle staff compatible.
- Aucun rôle navigateur propriétaire, superuser, BYPASSRLS, créateur de rôles/base ou membre d’un rôle privilégié, même sans héritage automatique.
- USAGE des schémas et droits nécessaires à service_role, sans confondre grants SQL et filtres RLS.
- Vingt signatures exactes uniquement ; SECURITY INVOKER et search_path fixé à pg_catalog,pg_temp. Aucune fonction étrangère ou surcharge non ciblée affectée.
- Absence de changement de données et possibilité de rétablir les permissions exactes, sans déduire les droits depuis les exports CSV incomplets.

La commande locale de génération est déjà préparée ; je peux l’exécuter moi-même après réception du fichier :

```powershell
npm run prepare:rollback -- ".qa-artifacts/backups/preactivation.json"
```

Elle n’exécute aucun SQL. Elle crée le vrai rollback sous `.qa-artifacts/backups/rollback-serverless-<timestamp>.sql`. Le fichier suivi dans Git `supabase/activation/rollback-serverless.sql` est seulement un garde-fou qui lève une erreur : **ce n’est pas le rollback de votre base**.

Le retour arrière est éprouvé sur une base isolée. Sa compatibilité avec l’état réel ne sera confirmée qu’après analyse de votre export et répétition adaptée. Toute dérive ou chaîne de délégation non prise en charge suspend l’opération. Je vous communiquerai ensuite le résultat, le fichier de rollback et les empreintes SQL à confirmer.

## 3. Exécuter l’activation — exclusivement après accord final

Les étapes suivantes sont documentées pour la suite ; elles ne sont pas une invitation à les exécuter maintenant.

1. Après validation de l’instantané et du rollback, donnez votre autorisation finale explicite pour **ce fichier et ce projet**. Une nouvelle capture est nécessaire si le schéma, les droits ou les données changent entre-temps.
2. Choisissez une période calme. Arrêtez les imports photographe et les autres écrivains/API utilisant ces tables. Conservez le backup et le rollback sous la main. Le script peut bloquer brièvement les écritures pendant les verrous/index ; il limite l’attente de verrou à 5 secondes et chaque instruction à 120 secondes.
3. Dans le même projet, créez **une nouvelle requête** privée, par exemple `AJ — activation serverless`. Ne réutilisez pas une requête contenant d’autres commandes.
4. Ouvrez localement `supabase/activation/activate-serverless.sql`, copiez **l’intégralité du fichier approuvé**, collez-la seule dans l’éditeur. Le script commence par BEGIN et finit par COMMIT. Ne collez pas les migrations 001 et 002 séparément, ni la migration 003.
5. Après vérification du projet/rôle postgres et de la totalité du texte, cliquez **Run** une seule fois. N’acceptez aucune proposition de réécriture automatique du SQL. Si une alerte ne correspond pas aux changements approuvés, annulez et demandez une vérification.
6. Attendez le résultat. Une exécution sans erreur signifie que le lot s’est terminé ; elle ne remplace pas les contrôles de la phase 4. Le résultat peut inclure celui du verrou consultatif et ne se limite pas nécessairement à « No rows returned ».
7. En cas d’erreur, arrêtez et conservez son code/message sans transmettre de secret. Ne forcez pas un COMMIT, ne retirez pas les contrôles, ne désactivez pas RLS et n’exécutez pas seulement les morceaux restants. La transaction protège contre l’activation partielle ; une transaction signalée comme échouée doit être close par ROLLBACK, pas par COMMIT.

Empreinte SHA-256 de la version actuelle, après normalisation CRLF → LF :
`0f3799c3b3339ecff83463df8e8960e1e6141e3a12d0b380cf273983d5a7d1e0`.
Cette empreinte sera recontrôlée au moment de la confirmation finale. Ne mélangez pas une ancienne sauvegarde avec une autre version du script.

## 4. Contrôler après l’activation autorisée

1. Créez encore **une nouvelle requête** dans le même projet, avec rôle postgres.
2. Copiez/collez intégralement `supabase/activation/verify-serverless-readonly.sql`, puis **Run**.
3. Résultat attendu : une ligne, colonne **verification**, avec **`all_checks_passed: true`** et neuf contrôles vrais. Le fichier n’appelle aucune RPC d’écriture et ne crée ni RSVP, ni message, ni URL signée.
4. Utilisez **Export → Copy as JSON**, puis enregistrez le résultat privé complet sous :
   `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3\.qa-artifacts\backups\postactivation-verification.json`
5. Je comparerai les six empreintes `business_fingerprints` aux `fingerprints` du backup initial. Elles doivent être identiques si les écrivains sont restés arrêtés. Les comptes égaux seuls ne suffisent pas à garantir une conservation exacte.
6. Si un contrôle est faux ou une empreinte diffère, arrêtez les essais d’écriture. N’ajoutez pas de grants permissifs ou de politiques publiques pour faire passer le contrôle. Analyse d’abord, rollback si nécessaire et autorisé.
7. Je lancerai les vérifications locales, puis les parcours réels dans le contexte de test autorisé : `npm run verify`, RSVP/billet, message/modération, connexion/déconnexion, refus sans rôle, import/finalisation et publication/masquage. Les vrais comptes ne nécessitent pas d’être transmis dans le chat ; la connexion peut être faite par vous dans l’interface locale.

## 5. Si un retour arrière devient nécessaire

- Il requiert une décision explicite après analyse de l’état courant. Ne lancez pas automatiquement un SQL de restauration ancien.
- Le seul fichier candidat est le rollback spécifique généré depuis votre snapshot, pas le garde-fou suivi dans Git.
- Arrêtez les écrivains et gardez les sauvegardes. Le rollback vérifie base, rôle/propriétaire, fonctions et schéma, puis restaure les ACL/configurations dans une transaction.
- Il préserve les lignes métier créées après activation. S’il trouve des données dans les nouvelles tables de coordination, il **refuse leur suppression** et demande un nouveau plan de conservation. Ne videz pas les tables pour contourner ce refus.
- Les droits antérieurs peuvent être moins sûrs ; un rollback ne doit pas rouvrir aveuglément les accès. Coordonner également le code applicatif avec le schéma restauré.

## État des vérifications locales

Audit et protections préalables : 15 tests isolés réussis précédemment. Le nouveau contrôle SQL Editor a aussi été exécuté sur la base de test : absence d’activation détectée, état activé validé, contenu métier inchangé, fuite EXECUTE et RLS désactivé détectés. Les résultats finaux de cette préparation sont dans `docs/audit/sql-editor-procedure.json`.

Les droits actuels complets du serveur ne sont pas encore certifiés : ils seront vérifiés depuis l’export de la phase 1. Aucune modification de `.env.local`, aucun push GitHub et aucun déploiement Vercel ne sont nécessaires à ces étapes.

Références primaires : [SQL Editor et fonctions](https://supabase.com/docs/guides/database/functions), [tests officiels Export → Copy as JSON](https://github.com/supabase/supabase/blob/master/e2e/studio/features/sql-editor.spec.ts), [traitement des résultats multi-instructions dans postgres-meta](https://github.com/supabase/postgres-meta/blob/master/src/lib/db.ts). Les libellés peuvent varier légèrement selon la version de l’interface ; aucun secret n’est à saisir pour cette procédure dans une session déjà connectée.
