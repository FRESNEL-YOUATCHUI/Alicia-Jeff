# Connecter le serveur à la feuille privée des invités

Le projet ne dispose pas actuellement des deux variables d'authentification Google requises.
La connexion Google Drive de Codex permet de lire la feuille dans cette conversation ; elle ne connecte pas le serveur local ou Vercel.

La feuille et l'onglet sont déjà configurés côté serveur :
- Feuille : https://docs.google.com/spreadsheets/d/1mikI1pPvSK0CvslUlUKlwROowJBP5Q9FCzGiZ9ucUB0/edit
- Onglet : Invités.
- Colonne A, à partir de la deuxième ligne ; l'en-tête est exclu.
- Ordre mixte des noms ; égalité exacte après normalisation, ambiguïtés refusées.
- Aucune modification de partage n'a été effectuée.

## 1. Compte de service

Dans Google Cloud Console, choisir/créer le projet dédié puis activer Google Sheets API.
Dans IAM et administration > Comptes de service, créer un compte dédié, par exemple alicia-jeff-lecture-invites.
Aucun rôle Propriétaire ou Éditeur du projet Google Cloud n'est nécessaire pour lire cette feuille.
Ne pas activer de délégation à l'ensemble du domaine.

Référence : [identifiants Google Workspace](https://developers.google.com/workspace/guides/create-credentials).

## 2. Identifiants privés

Si la politique de votre organisation l'autorise, créer une clé JSON du compte de service.
Cette opération est à effectuer par vous : l'agent ne crée ni ne modifie de clé.
Garder le fichier hors du dépôt ; ne pas le déposer dans public/, src/, Git ou le chat.
Si la création de clés est interdite par l'organisation, ne pas désactiver cette protection : demander à l'administrateur une méthode d'identification approuvée.

Référence : [création des clés de compte de service](https://docs.cloud.google.com/iam/docs/keys-create-delete).

## 3. Lecture de la seule feuille

Dans le bouton Partager de la feuille, ajouter l'adresse client_email du compte de service en rôle Lecteur.
C'est une modification d'accès : elle reste à votre décision/autorisation. L'agent ne l'effectuera pas sans votre accord.
Conserver Accès général : Accès limité. Ne pas publier sur le Web.
Les rôles IAM Google Cloud ne donnent pas à eux seuls accès à une feuille Google Workspace.

## 4. Variables du backend

Vous renseignez vous-même ces deux variables, sans transmettre leurs valeurs dans cette conversation :
- GOOGLE_SERVICE_ACCOUNT_EMAIL : valeur client_email du JSON.
- GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY : valeur private_key du JSON.

En local : variables de l'environnement du processus serveur ou .env.local privé.
Sur Vercel : Settings > Environment Variables, dans les environnements à tester.
La clé peut contenir de vrais sauts de ligne ou les séquences littérales backslash-n ; les deux formes sont prises en charge.
Ne mettre aucun préfixe VITE_ : ces identifiants ne doivent jamais être incorporés au frontend.

L'identifiant et la plage ont déjà des valeurs par défaut côté serveur. Les variables GOOGLE_SHEETS_SPREADSHEET_ID et GOOGLE_SHEETS_RANGE restent facultatives pour les remplacer.
La plage par défaut est 'Invités'!A2:A. La lecture est limitée côté serveur à 10 000 lignes et 2 Mio.
Le seul scope utilisé est spreadsheets.readonly. Le compte ne doit avoir accès qu'aux fichiers nécessaires.

Références : [scopes Sheets](https://developers.google.com/workspace/sheets/api/scopes), [notation A1](https://developers.google.com/workspace/sheets/api/guides/concepts).

## 5. Validation

Redémarrer le serveur après configuration des variables.
Exécuter npm run inspect:tickets : sheet.ready doit être true.
Cette commande ne confirme personne et n'enregistre aucune entrée.
Elle restera en échec si la migration 004 manque, si la clé est invalide ou si la feuille n'est pas partagée avec le compte de service.

npm run verify contrôle désormais aussi cette connexion réelle et le schéma QR.
npm run verify:code contrôle seulement le code, le build et le runtime existant ; sa réussite n'annonce pas la mise en service de la vérification des billets.

Aucun secret existant ni aucune autorisation de partage n'a été modifié par l'agent.

Les QR utilisent l'adresse publique https://alicia-jeff.vercel.app, même si le billet est téléchargé en local. La production doit donc contenir les correctifs et la migration doit être activée avant de distribuer ces billets.
