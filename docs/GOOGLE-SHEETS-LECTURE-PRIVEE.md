# Google Sheets privée — authentification OIDC sans clé

Le backend utilise la fédération Vercel → Google STS → IAM Credentials → Google Sheets.
Aucune clé JSON, clé privée Google ou délégation à l’ensemble du domaine n’est nécessaire.
Aucun identifiant Google ni jeton n’est envoyé au frontend.

## Identité de production confirmée

- Projet Google Cloud : alicia-jeff-mariage.
- Numéro technique : 691833411750.
- Pool technique : alicia-jeff-vercel.
- Fournisseur technique : vercel-alicia-jeff.
- Ressource : projects/691833411750/locations/global/workloadIdentityPools/alicia-jeff-vercel/providers/vercel-alicia-jeff.
- Compte de service : alicia-jeff-invites@alicia-jeff-mariage.iam.gserviceaccount.com.
- Émetteur : https://oidc.vercel.com/dev-full1.
- Audience du jeton Vercel : https://vercel.com/dev-full1.
- Sujet exact : owner:dev-full1:project:alicia-jeff:environment:production.

Ces identifiants techniques ont été fournis comme vérifiés par le propriétaire.
L’agent ne modifie ni leurs permissions ni leur configuration Google Cloud.

L’audience STS est différente de l’audience du jeton Vercel :
`//iam.googleapis.com/projects/691833411750/locations/global/workloadIdentityPools/alicia-jeff-vercel/providers/vercel-alicia-jeff`.

## Configuration serveur

Les valeurs vérifiées ci-dessous ont des valeurs par défaut côté serveur dans serverless/google-oidc.mjs.
Les variables sont facultatives ; si elles sont définies, elles doivent correspondre exactement aux valeurs vérifiées.
Aucun changement de .env.local n’est réalisé automatiquement.

| Variable | Valeur non secrète attendue |
| --- | --- |
| GCP_PROJECT_ID | alicia-jeff-mariage |
| GCP_PROJECT_NUMBER | 691833411750 |
| GCP_WORKLOAD_IDENTITY_POOL_ID | alicia-jeff-vercel |
| GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID | vercel-alicia-jeff |
| GCP_SERVICE_ACCOUNT_EMAIL | alicia-jeff-invites@alicia-jeff-mariage.iam.gserviceaccount.com |

La feuille existante et la plage ont leurs valeurs par défaut côté serveur :
- Feuille officielle déjà utilisée par le projet ; aucune nouvelle feuille n’est créée.
- Onglet Invités, colonne A avec l’en-tête Nom complet.
- GOOGLE_SHEETS_SPREADSHEET_ID et GOOGLE_SHEETS_RANGE peuvent remplacer la cible côté serveur.
- GUEST_NAME_ORDER vaut mixed par défaut : deux ordres exacts acceptés, ambiguïtés refusées.

Les variables système VERCEL=1 et VERCEL_ENV=production sont requises.
Le SDK @vercel/oidc obtient le jeton dans le contexte de la requête.
Ne pas copier de jeton dans le chat, dans Git ou dans une variable VITE_.
Ne pas renseigner manuellement un jeton permanent pour remplacer le contexte de production.

GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY n’est plus utilisée : aucun mode JWT à clé privée ni fallback ADC n’est exécuté.
La connexion Google Drive de Codex sert à l’audit et n’authentifie pas le backend.

## Chaîne d’authentification

1. Le lecteur est appelé uniquement à la vérification du billet, jamais pendant le RSVP.
2. Le SDK obtient une assertion Vercel fraîche pendant la requête, sans audience personnalisée.
3. Le backend rejette les identités non conformes et les dates invalides. Le décodage local du JWT n’est pas une vérification de signature : Google STS effectue la validation cryptographique.
4. STS reçoit l’assertion et l’audience IAM numérique. Le scope intermédiaire cloud-platform est requis pour appeler IAM Credentials ; il n’est pas utilisé pour lire Sheets.
5. IAM Credentials émet un jeton du compte de service avec uniquement spreadsheets.readonly et une durée demandée de 600 secondes.
6. Ce jeton temporaire autorise la lecture privée de la colonne A.

Les endpoints sont fixes, les redirections refusées, les réponses d’authentification limitées à 64 Kio.
L’obtention du jeton Vercel et les deux échanges Google partagent un délai global de sept secondes.
La lecture Sheets conserve ses limites de huit secondes, 10 000 lignes et 2 Mio.
Aucun jeton ni résultat de liste n’est conservé entre scans ; aucune erreur Google brute n’est renvoyée au navigateur.

## Restrictions conservées

Les environnements local, Development et Preview sont refusés par ce mode d’authentification.
Ne pas modifier le sujet Google Cloud ou simuler VERCEL_ENV=production en local pour contourner ce refus.
Le site et le RSVP restent utilisables sans accès à Sheets ; le contrôle d’entrée refuse l’autorisation si la liste ne peut pas être lue.
La correspondance reste exacte après normalisation de casse, espaces et accents. Les doublons/homonymes sont refusés.
La feuille reste en accès limité, avec le compte de service Lecteur. Ne pas publier sur le Web.

## Validation locale

- npm run test:oidc : tests du SDK et du protocole avec transports simulés ; aucune identité de production utilisée.
- npm test : régression du RSVP, des billets et des règles de scan sur une base isolée.
- npm run verify:code : vérifications du code et du runtime, sans annoncer une validation Google réelle.
- npm run inspect:tickets : lecture de configuration et contrôle du schéma ; en local, sheet.code=production_identity_required est attendu et le code de sortie est 2.
- npm run verify inclut inspect:tickets : il ne doit pas annoncer une connexion Google opérationnelle depuis un environnement non autorisé.

Les tests ne modifient ni Supabase hébergé ni Google Cloud.

## Vérifications manuelles avant mise en service

1. Dans le projet Vercel alicia-jeff de l’équipe dev-full1, vérifier que la fédération OIDC est activée, avec l’émetteur d’équipe attendu et les variables système exposées aux fonctions.
2. Vérifier les éventuelles variables GCP_* de Production : aucune valeur contradictoire avec les identifiants vérifiés. Aucun secret Google permanent à ajouter.
3. Confirmer que les API Sheets, STS et IAM Credentials sont toujours actives et que le compte de service reste Lecteur de la feuille privée.
4. Effectuer personnellement le push et le déploiement lorsque souhaité.
5. Après ce déploiement, commencer par le diagnostic HTTP OIDC protégé décrit ci-dessous : aucun billet n’est consommé. Une validation Google réelle reste un contrôle distinct ; ne pas utiliser un scan de billet reconnu comme simple contrôle de santé.
6. Vérifier qu’un refus Google n’autorise jamais l’entrée et qu’un invité absent peut toujours confirmer son RSVP.

Aucun déploiement ni test réel d’admission n’est effectué automatiquement par cette adaptation.

## Diagnostic HTTP OIDC protégé

GET /api/admin/oidc-readiness utilise exactement la même autorisation que /api/admin/state :
jeton Bearer vérifié par Supabase Auth (getUser), puis lecture du rôle wedding_staff.
Les rôles admin et photographer sont acceptés. Aucun accès anonyme ni simple rôle authenticated.
L’absence de jeton renvoie 401 ; un compte sans rôle autorisé renvoie 403.

La réponse autorisée est HTTP 200 avec seulement neuf booléens. Les erreurs d’authentification
conservent le format HTTP existant. Cache-Control vaut private, no-store. Seule la méthode GET est autorisée.

| Indicateur | Signification |
| --- | --- |
| vercel_variable_present | VERCEL est définie comme chaîne, même si sa valeur est incorrecte. |
| vercel_flag_valid | VERCEL vaut exactement 1. |
| vercel_env_variable_present | VERCEL_ENV est définie comme chaîne. |
| production_environment | VERCEL_ENV vaut exactement production. |
| google_configuration_valid | Les éventuelles valeurs GCP ne contredisent pas les identifiants vérifiés. |
| request_oidc_token_present | La requête Node contient l’en-tête OIDC attendu. |
| sdk_token_accessible | Le SDK lit le même jeton que celui de cette requête. |
| identity_claims_match | Les claims d’identité et les dates correspondent aux contrôles de l’adaptateur. |
| ready | Toutes les conditions précédentes sont satisfaites. |

Le SDK n’est pas sollicité en local, en Preview/Development, si VERCEL est incorrecte ou si l’en-tête
OIDC manque. Dans ces cas, sdk_token_accessible et identity_claims_match restent false.
Le diagnostic emploie getVercelOidcTokenSync dans le contexte courant, sans renouvellement CLI,
lecture de fichier de jeton, échange STS, appel IAM ni lecture Sheets. Un jeton d’environnement seul
ne suffit pas : son absence dans la requête, ou une différence avec celui lu par le SDK, rend ready false.
Aucun jeton ni erreur SDK brute n’est journalisé ou renvoyé.

identity_claims_match est un précontrôle local ; ce n’est pas une vérification cryptographique de signature.
ready ne prouve pas les permissions Google ou la lecture effective de Sheets. Google STS conserve son rôle
de validation lors du vrai contrôle du billet. Le diagnostic n’appelle aucun RPC métier, compteur de débit,
RSVP ou fonction d’admission. Supabase n’est utilisé que pour vérifier la session et lire le rôle.

### Procédure exacte après votre déploiement

1. Ouvrir https://alicia-jeff.vercel.app/ puis Souvenirs → Images → Espace photographe.
2. Se connecter avec le compte existant admin ou photographer. Rester sur cette même origine.
3. Ouvrir les outils de développement du navigateur, onglet Console.
4. Exécuter le bloc ci-dessous. Il utilise la session déjà stockée par le client Supabase du site,
   sans afficher, copier ou demander le jeton. Ne jamais coller de clé serveur ou de jeton dans le chat.

```javascript
(async () => {
  const raw = localStorage.getItem('sb-mcnpagbcehupdbhshcea-auth-token');
  const session = raw ? JSON.parse(raw) : null;
  if (!session?.access_token) { console.info('Connectez-vous à l’espace photographe.'); return; }
  const response = await fetch('/api/admin/oidc-readiness', {
    method: 'GET', cache: 'no-store', credentials: 'same-origin',
    headers: { Authorization: 'Bearer ' + session.access_token }
  });
  if (!response.ok) { console.info('Diagnostic refusé ou indisponible : HTTP ' + response.status); return; }
  const data = await response.json();
  const fields = ['vercel_variable_present', 'vercel_flag_valid', 'vercel_env_variable_present',
    'production_environment', 'google_configuration_valid', 'request_oidc_token_present',
    'sdk_token_accessible', 'identity_claims_match', 'ready'];
  if (Object.keys(data).length !== fields.length || !fields.every(k => typeof data[k] === 'boolean')) {
    console.info('Réponse inattendue : aucun contenu affiché.'); return;
  }
  console.table(Object.fromEntries(fields.map(k => [k, data[k]])));
})().catch(() => console.info('Diagnostic impossible ; reconnectez-vous et réessayez.'));
```

5. En Production correctement configurée, les neuf indicateurs doivent être true.
   Si vercel_variable_present ou vercel_env_variable_present est false, les variables système
   ne sont pas présentes dans la fonction. Si les variables existent mais les contrôles correspondants
   sont false, leur valeur n’est pas celle attendue. Ne pas les fabriquer manuellement.
6. Si request_oidc_token_present ou sdk_token_accessible est false malgré l’environnement autorisé,
   vérifier l’injection OIDC de la fonction. Si identity_claims_match est false, vérifier l’émetteur,
   l’audience et le sujet configurés, sans afficher les claims ou assouplir les restrictions.
7. Un accès direct à /api/admin/oidc-readiness dans la barre d’adresse renvoie normalement 401 :
   la session locale n’ajoute pas automatiquement un en-tête Authorization à cette navigation.
8. Après déconnexion, cet accès direct doit toujours renvoyer 401.

Cette procédure ne confirme aucune présence et ne consomme aucun billet. Elle ne nécessite
aucun billet réel, aucune modification de la feuille et aucune écriture Supabase par le diagnostic.
En cas de 401 dans la console, se reconnecter puis relancer ; en cas de 403, vérifier le rôle existant.
Les tokens, en-têtes Authorization et contenus de stockage du navigateur ne doivent jamais être partagés.

Tests locaux spécifiques : node --test tests/oidc-diagnostic.test.mjs.
Ils simulent le contexte Vercel et les réponses Auth/rôles ; aucun déploiement ou test réel Production
n’est exécuté par ces tests.

## Diagnostic temporaire de lecture Google réelle

GET /api/admin/google-sheets-readiness vérifie STS → IAM Credentials → Sheets dans la fonction Vercel.
Il réutilise le lecteur OfficialList et l’adaptateur OIDC de production. Il est protégé par la même
vérification de session et de rôle que le diagnostic OIDC, avec une restriction supplémentaire au rôle admin.
Un compte photographer conserve son accès au diagnostic OIDC, mais reçoit 403 sur ce diagnostic Google sans autorisation propriétaire temporaire.
Aucun rôle existant n’est modifié automatiquement.

La cible est fixée côté serveur : feuille officielle existante, plage exacte 'Invités'!A2:A.
Les paramètres HTTP et les remplacements de feuille/plage ne peuvent pas changer cette cible de diagnostic.
Le lecteur valide le format de la liste, mais aucun nom, ligne, comptage ou résultat de comparaison n’est renvoyé.
Un nom sentinelle en mémoire permet de réutiliser le lecteur sans créer de RSVP ni consulter un billet.
Le scope final reste spreadsheets.readonly. Aucun RPC métier, admission, compteur ou stockage Supabase n’est appelé.
Seules la vérification de session et la lecture du rôle utilisent Supabase.

### Activation limitée dans le temps

La route est désactivée par défaut. Deux variables serveur NON SECRÈTES doivent être ajoutées manuellement
au seul environnement Vercel Production, avant le futur déploiement de cette version :

| Variable | Valeur |
| --- | --- |
| GOOGLE_SHEETS_READINESS_ENABLED | true |
| GOOGLE_SHEETS_READINESS_UNTIL | Une date UTC future, par exemple l’heure actuelle + une heure, au format ISO avec Z. |

Pour calculer la date sans secret, la console du navigateur peut exécuter :

```javascript
new Date(Date.now() + 60 * 60 * 1000).toISOString();
```

Copier seulement la date obtenue dans GOOGLE_SHEETS_READINESS_UNTIL. Aucun jeton, clé JSON ou changement IAM requis.
Ne pas créer ou modifier VERCEL/VERCEL_ENV : leurs contrôles restent stricts.
Sans activation explicite ET date valide future, le diagnostic retourne 404/diagnostic_disabled sans appel Google.
À l’échéance, il se désactive automatiquement, y compris dans les instances déjà démarrées.

### Fréquence et cache

Une seule tentative Google par minute, tous administrateurs confondus, et un seul appel simultané PAR INSTANCE.
Les tentatives Google échouées consomment également le délai. HTTP 429 et Retry-After indiquent le délai restant.
Cette protection est en mémoire : elle est réinitialisée à froid et ne constitue pas une limite globale entre
instances ou régions Vercel. Une limite globale nécessiterait un mécanisme distribué ou le pare-feu Vercel ;
aucun de ces réglages n’est modifié ici. Le rôle admin et la fenêtre d’activation limitent l’usage de ce diagnostic temporaire.
Aucune réponse ni jeton Google n’est mis en cache ; une nouvelle tentative autorisée relit la feuille.
Les réponses, y compris les erreurs, portent les directives privées/no-store et des directives CDN no-store.

### Test après votre déploiement

1. Activer les deux variables ci-dessus en Production, avec une échéance courte, puis déployer personnellement cette version.
2. Ouvrir le site, Souvenirs → Images → Espace photographe, et se connecter avec un compte déjà admin.
   Un compte simplement photographer ne suffit pas. Ne pas changer de rôle pour contourner un refus.
3. Rester sur cette même origine et exécuter le bloc suivant dans la console du navigateur.
   Le jeton de la session existante reste en mémoire et n’est jamais affiché ou demandé dans le chat.

```javascript
(async () => {
  const session = JSON.parse(localStorage.getItem('sb-mcnpagbcehupdbhshcea-auth-token') || 'null');
  if (!session?.access_token) { console.info('Connectez-vous avec un compte admin.'); return; }
  const response = await fetch('/api/admin/google-sheets-readiness', {
    method: 'GET', cache: 'no-store', credentials: 'same-origin',
    headers: { Authorization: 'Bearer ' + session.access_token }
  });
  const data = await response.json();
  if (response.ok && data.ready === true && data.sheets_readable === true && Object.keys(data).length === 2) {
    console.table({ ready: true, sheets_readable: true });
    return;
  }
  const allowed = ['authentication_required', 'invalid_token', 'staff_required', 'admin_required',
    'diagnostic_disabled', 'diagnostic_rate_limited', 'google_sheets_unavailable'];
  console.info({ http: response.status, ready: false, code: allowed.includes(data.code) ? data.code : 'diagnostic_unavailable' });
})().catch(() => console.info('Diagnostic indisponible ; reconnectez-vous et réessayez.'));
```

4. Attendre HTTP 200 avec exactement ready=true et sheets_readable=true. Cela confirme, pour cette requête,
   l’échange OIDC auprès de STS, l’emprunt d’identité IAM et la lecture réelle de la plage officielle.
   Aucun scan ni billet n’est nécessaire. Ne pas utiliser un billet reconnu comme contrôle de santé.
5. HTTP 401 : se reconnecter ; 403/admin_required : compte non admin ; 404/diagnostic_disabled :
   activation absente, désactivée, mal formée ou expirée ; 429 : respecter Retry-After.
   HTTP 503/google_sheets_unavailable est volontairement générique : aucune erreur Google brute n’est exposée.
6. Après succès, laisser expirer l’échéance courte. Une requête admin ultérieure doit retourner 404 sans Google.
   Pour désactiver plus tôt, définir GOOGLE_SHEETS_READINESS_ENABLED=false et redéployer personnellement ;
   les changements de variables ne modifient pas rétroactivement les fonctions déjà déployées.
7. La suppression définitive peut faire l’objet d’un changement séparé : retirer cette route/importation,
   le module google-sheets-readiness.mjs et ses variables de diagnostic. Le contrôle normal des billets reste indépendant.

La chaîne réelle n’est pas exécutée contre Google par les tests locaux : transports Google et réponses Auth/rôles
sont simulés. Le SDK, l’adaptateur, le lecteur et le routage HTTP réels sont exercés, sans données hébergées modifiées.
Tests ciblés : node --test tests/google-sheets-readiness.test.mjs.

## Autorisation temporaire du propriétaire sans rôle administrateur

Le contrôle distant en lecture seule du 20 novembre confirme zéro compte admin et un compte photographer.
Le propriétaire peut désormais autoriser uniquement le diagnostic Google pour son propre compte déjà authentifié.
Aucun rôle Supabase, privilège SQL, permission Storage ou permission Google Cloud n’est modifié.

Sur l’ordinateur du propriétaire qui possède déjà la configuration serveur privée du projet :

```powershell
npm run owner:grant -- --user-id UUID_DU_COMPTE_PROPRIETAIRE
```

Remplacer UUID_DU_COMPTE_PROPRIETAIRE par l’identifiant du compte concerné dans Supabase Auth.
Cet identifiant ne doit pas être envoyé dans le chat. La commande utilise la clé serveur locale existante
comme clé HMAC, sans l’afficher ni la modifier. Elle n’effectue aucune opération réseau.
Elle vérifie l’exclusion Git puis écrit seulement .qa-artifacts/private/owner-google-probe.json.
Le jeton n’est pas imprimé. Il est lié par empreinte au compte exact, à ce seul endpoint et expire après dix minutes
(quinze minutes maximum imposées au format). Le fichier est une capacité privée à garder hors Git et hors messagerie.

Après votre déploiement de cette version : ouvrir /photographe, se connecter avec le compte correspondant,
puis Diagnostics temporaires du propriétaire. Charger le fichier local et cliquer Vérifier Google Sheets.
Le fichier est lu en mémoire ; le jeton est transmis seulement dans l’en-tête X-AJ-Owner-Probe du diagnostic.
Le JWT Supabase habituel reste obligatoire. Sans session, mauvais compte, signature modifiée ou expiration : refus.
La délégation ne peut pas servir à une autre API et ne change pas le rôle du photographe.
Les deux variables d’activation Production et leur échéance, ainsi que toutes les restrictions OIDC, restent obligatoires.

Traçabilité : le fichier local et la sortie de la commande portent une référence d’audit aléatoire.
Une utilisation autorisée produit un événement owner_google_probe dans les logs serveur Vercel avec cette référence,
la date et le statut HTTP ; aucun nom, identifiant de compte, jeton, claim ou secret n’est journalisé.
Il s’agit d’une délégation réutilisable pendant sa courte fenêtre, soumise au cooldown par instance, et non d’un jeton
à usage unique garanti entre instances. Après validation : laisser expirer la délégation et la fenêtre de diagnostic,
puis retirer l’activation ou supprimer le diagnostic lors d’un changement ultérieur.

Références officielles :
- https://vercel.com/docs/oidc/reference
- https://vercel.com/docs/oidc/gcp
- https://cloud.google.com/iam/docs/reference/sts/rest/v1/TopLevel/token
- https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken
- https://developers.google.com/workspace/sheets/api/scopes
