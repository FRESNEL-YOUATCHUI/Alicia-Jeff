# RSVP et billets QR — bilan du 18 novembre 2026

**Mise à jour du 19 novembre :** voir le [diagnostic et les correctifs actuels](CORRECTION-QR-20261119.md). Ce bilan précise la version réellement en ligne et les prérequis encore bloqués.

## État réel

Projet : `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`.
Le vrai frontend compilé, les vrais handlers et les fonctions SQL ont été testés ensemble dans un environnement isolé.
`npm run verify` réussit : **7 tests historiques, 88 tests API/SQL/runtime, 7 assertions de défilement**, TypeScript, lint, build et recherche de secrets.
Les **16 contrôles du runtime normal utilisent réellement Supabase en lecture seule** et réussissent.

**Le nouveau contrôle d'entrée n'est pas encore activé sur Supabase.** Aucun SQL hébergé, push GitHub, déploiement, changement de secret, Storage ou Auth n'a été effectué.
Le lecteur Google Sheets du backend attend encore sa configuration privée. La connexion Google Drive de Codex ne fournit pas automatiquement des identifiants à Vercel.

## RSVP et téléchargement

Le formulaire et sa présentation sont conservés. Le champ de nombre de personnes est supprimé ; chaque nouvelle confirmation vaut une personne.
Le RSVP ne consulte jamais la liste officielle. Une personne absente de celle-ci reçoit aussi sa confirmation et son billet.

Un verrou immédiat empêche les doubles clics. La référence privée persistante du navigateur, son empreinte et la contrainte UNIQUE existante évitent les doublons pendant les reprises réseau.
Cette garantie concerne la même référence. Elle n'empêche pas des confirmations volontaires depuis différents appareils ; l'entrée reste limitée à une occurrence du nom officiel.
Si le stockage local est refusé, la référence reste stable pendant la session de page ; la restauration après fermeture n'est alors pas garantie.

Après enregistrement réussi, le PDF est généré et son téléchargement lancé automatiquement. Le message dit « lancé » : JavaScript ne peut garantir l'enregistrement final sur le disque.
Une erreur de téléchargement ne remet pas en cause la confirmation. Les boutons PDF et PNG permettent de réessayer.
Au rechargement, le cache est conservé et le billet est récupéré côté serveur par la référence privée ; aucun nouveau téléchargement automatique n'est imposé.

Avant activation SQL, l'absence explicite du nouveau RPC dans PostgREST utilise le **vrai RSVP historique**, avec `entry_verification_ready:false`.
Les anciennes cartes restent téléchargeables avec le QR `AJ:UUID`. Aucune entrée n'est simulée.
Après activation, une récupération/reconfirmation fournit un QR version 2. Il faut télécharger à nouveau les anciennes cartes pour qu'une caméra native puisse ouvrir leur lien.

## Feuille officielle créée et vérifiée

[Ouvrir la feuille privée](https://docs.google.com/spreadsheets/d/1mikI1pPvSK0CvslUlUKlwROowJBP5Q9FCzGiZ9ucUB0/edit)

Onglet `Invités`, colonne unique `Nom complet`, un en-tête et **72 personnes**.
Les 72 valeurs ont été relues après import et comparées à la source, dans le même ordre ; aucun doublon normalisé n'est présent.
Google Drive indique `shared:false` et une seule permission `user:owner`. Aucun partage public ou de domaine n'a été créé.
**Ne pas activer « Publier sur le Web » ni « Tous les utilisateurs disposant du lien ».**

L'ordre mixte est pris en charge conformément à votre précision :
1. Le serveur normalise `prénom + nom` et `nom + prénom`.
2. Seuls les espaces, la casse et les accents changent. Ponctuations, civilités et parties de noms sont conservées.
3. Il exige une égalité complète avec une des deux formes. Aucun tri de mots ou rapprochement approximatif.
4. Plusieurs lignes correspondantes, même si elles représentent les deux ordres, donnent une erreur pour ambiguïté ; aucune entrée.
5. Les noms composés doivent être saisis intégralement. Les erreurs/civilités indésirables doivent être corrigées par le propriétaire de la feuille.
6. Chaque contrôle recharge la liste. Aucun refus durable n'est enregistré : un invité ajouté ultérieurement peut être reconnu au prochain scan.

Avec une colonne de noms, deux personnes réellement homonymes ne peuvent être distinguées automatiquement. Leur ambiguïté doit être résolue par l'organisateur. Aucune ligne n'est dédoublonnée automatiquement.

## Vérification QR

Le QR version 2 contient uniquement `https://<domaine>/api/tickets/open?token=<jeton-aléatoire>`.
Le jeton indépendant du UUID RSVP contient **256 bits aléatoires**, sur 43 caractères. Aucune donnée personnelle n'est encodée.
UUID RSVP et numéro de billet sont conservés. Le jeton est stocké dans une table privée pour le re-téléchargement. Ne pas journaliser ou diffuser les liens complets.

Le GET ouvre une page minimale sur le même site, sans enregistrer d'entrée. Aucun compte vigile, application de scan ou nouvel espace administratif.
Le POST exige une preuve signée de 90 secondes, un cookie HttpOnly lié au billet, une origine cohérente et un contexte same-origin.
Les aperçus/préchargements connus ne reçoivent pas de preuve utilisable. La page attend d'être visible et focalisée.
Une navigation signalée comme volontaire par `Sec-Fetch-User` lance le contrôle automatiquement. Sans ce signal, le secours est un bouton sur **la même page de résultat**.

Le backend recherche le billet et son RSVP, lit la liste privée puis tente l'entrée atomique :

| Résultat | Effet |
| --- | --- |
| BILLET VALIDE | Première entrée enregistrée |
| INVITÉ NON RECONNU | Aucune égalité exacte ; aucune consommation |
| BILLET NON RECONNU | Jeton inconnu ou invalide |
| BILLET DÉJÀ UTILISÉ | Billet ou nom officiel déjà admis |
| ERREUR DE VÉRIFICATION | Panne, ambiguïté ou identité modifiée pendant le contrôle ; aucune entrée |

La transaction verrouille le RSVP puis le billet, vérifie sa version et enregistre une seule entrée.
Une contrainte unique sur l'empreinte du nom officiel interdit une seconde entrée via une autre confirmation.
Après admission, un changement d'identité est refusé. Ne pas réordonner/réécrire les noms officiels pendant les admissions.

### Limites explicites

Un robot malveillant imitant entièrement une navigation humaine ne peut pas être distingué avec certitude dans ce parcours anonyme.
Tout détenteur d'un vrai lien peut lancer son contrôle, même à distance ou avant l'événement. Sans connexion vigile, la présence physique et l'identité du scanneur ne peuvent être garanties.
Ne pas scanner de vrais billets pour une démonstration avant leur entrée. Une copie du billet reste valable pour le premier scanneur : aucun contrôle d'identité physique n'est ajouté.

Limites : JSON 16 Kio ; 40 RSVP et 40 récupérations/IP/15 min ; 120 ouvertures et 120 contrôles/IP/min ; 6 contrôles/billet/IP/min ; 45 lectures de liste au total/min.
Liste : 10 000 lignes maximum, réponse limitée à 2 Mio, délais OAuth 5 s et lecture 8 s.
Un quota ou une panne bloque l'entrée. Aucun cache positif périmé ne permet de l'autoriser.
Les 45 lectures gardent une marge sous le quota Google habituel de 60 lectures/compte/minute ; vérifier les quotas réels du projet Google.

## SQL complémentaire — préparé, non appliqué

Fichier : `supabase/migrations/004_ticket_entry.sql`.

- Une table privée `wedding_ticket_entries`.
- Quatre fonctions : `wedding_api_confirm`, `wedding_api_ticket_restore`, `wedding_api_ticket_lookup`, `wedding_api_ticket_enter`.
- Clés primaire/étrangère, unicité des RSVP, jetons et noms admis.
- RLS activé, aucune politique navigateur ; droits directs et EXECUTE refusés à `anon` et `authenticated`.
- Fonctions `SECURITY INVOKER`, `search_path=pg_catalog,pg_temp` ; accès exclusivement côté service/propriétaire.
- Aucun remplacement des vingt fonctions initiales, aucune modification des six tables métier, de leurs politiques, de Storage ou d'Auth.

La FK RESTRICT empêchera de supprimer un RSVP ayant un billet, pour préserver la preuve d'entrée.
Le script est transactionnel et réexécutable sur le schéma attendu. Un propriétaire ou une politique inattendue interrompt son exécution.

Procédure **après une nouvelle autorisation explicite seulement** :
1. Suspendre brièvement les confirmations afin de comparer les empreintes.
2. Dans SQL Editor de `alicia-jeff-wedding`, lancer le script existant `supabase/activation/preflight-backup-readonly.sql`. Enregistrer le JSON complet dans `.qa-artifacts/backups/`, jamais dans Git ou le chat. Il contient des données personnelles et les droits précédents.
3. Exécuter `supabase/activation/inspect-ticket-entry-readonly.sql` ; conserver le résultat « avant ». La table et les quatre fonctions doivent être absentes ; sinon arrêter et auditer leur structure.
4. Après autorisation finale, exécuter uniquement `supabase/migrations/004_ticket_entry.sql`.
5. Relancer l'inspection. Les six empreintes métier, RLS/politiques et l'empreinte des vingt fonctions originales doivent rester identiques. Contrôler les quatre fonctions, leur search_path, leurs droits et la nouvelle table privée.
6. Configurer la lecture Google privée puis lancer `npm run inspect:tickets`.
7. Tester une confirmation et un scan sur des données de test autorisées. Le scan d'un vrai billet le consomme réellement.

Rollback de désactivation : `supabase/activation/rollback-ticket-entry.sql`.
Il révoque les droits service sur les quatre fonctions et la nouvelle table, puis demande le retour au code précédent. Il ne supprime aucune confirmation, jeton ou entrée. Les vingt fonctions initiales gardent leurs droits.
Une réactivation contrôlée est possible avec 004. **Ne pas employer l'ancien rollback global après création de billets d'entrée.**

## Configuration manquante

Aucune valeur de `.env.local` n'a été modifiée. `.env.example` contient les noms requis et l'identifiant non secret de la feuille.

À configurer vous-même, localement puis dans Vercel, exclusivement côté serveur :
- `GOOGLE_SHEETS_SPREADSHEET_ID` : `1mikI1pPvSK0CvslUlUKlwROowJBP5Q9FCzGiZ9ucUB0`.
- `GOOGLE_SHEETS_RANGE` : `'Invités'!A2:A10001`.
- Authentification actuelle : OIDC Vercel → STS → IAM Credentials, sans clé privée Google.
- Paramètres GCP_* serveur et restriction Production : voir docs/GOOGLE-SHEETS-LECTURE-PRIVEE.md.
- `GUEST_NAME_ORDER=mixed` est facultatif : c'est déjà le comportement par défaut.

Activer Google Sheets API dans le projet Google du compte de service. Partager uniquement cette feuille avec lui, en lecture ; ne pas ouvrir tout votre Drive.
La bibliothèque officielle `google-auth-library` utilise le seul scope `spreadsheets.readonly`.
La connexion Google Drive de Codex n'est pas un secret à extraire ou à copier dans le site.

## Tests exécutés

| Scénario | Résultat et portée |
| --- | --- |
| Invité reconnu : RSVP et billet | Réussi en API/SQL isolés et navigateur, noms synthétiques |
| Invité absent : RSVP et billet | Réussi ; aucune consultation de la liste pendant RSVP |
| Téléchargement automatique | PDF réel enregistré par le navigateur |
| Re-téléchargement manuel | PNG réel enregistré ; QR du fichier décodé, URL et jeton vérifiés |
| Panne de téléchargement | Confirmation conservée, message et secours affichés. Nouvel essai lancé ; le deuxième fichier après cette panne n'a pas été observé sur disque |
| Rechargement | Confirmation et même billet retrouvés |
| Accompagnants | Zéro champ dans le DOM |
| Scan reconnu puis répété | VALIDE puis DÉJÀ UTILISÉ observés automatiquement dans le navigateur isolé |
| Absent puis ajouté à la liste | Refus sans consommation, puis reconnaissance au scan suivant |
| Identifiant inconnu/falsifié | Refus, aucune lecture Google |
| Deux scans simultanés | Une seule réussite, y compris sur deux connexions PostgreSQL 16.9 distinctes |
| Deux billets pour le même nom | Une seule admission, aussi avec deux connexions distinctes |
| Liste/base indisponible | Refus sûr ; page minimale d'erreur si même l'ouverture ne peut contacter la base |
| Ordre mixte, doublons, ambiguïtés | Correspondance exacte ou refus, aucune approximation |
| GET/HEAD/robots/préchargements | Aucune entrée ; preuve expirée/falsifiée, cookie ou billet incorrect refusés |
| SQL et rollback | Accès navigateur refusés ; données conservées après répétition et désactivation |
| Responsive | 390 et 1440 pixels ; aucun débordement horizontal constaté |
| Google Sheets réel via Codex | Import, 72 valeurs et permissions privées vérifiés |
| Google Sheets depuis le backend | Non validé : quatre variables manquantes |
| Écritures/entrées Supabase hébergées | Non effectuées : nouvelle migration non autorisée |
| Caméra physique iPhone/Android | Non testée ; QR décodé et navigation de son URL testés |
| Auth/Storage | Tests existants conservés et réussis ; pas de nouvelle écriture réelle Storage |

Les tests isolés ne remplacent pas la validation Google/Supabase hébergée après configuration.
Preuves sans liste d'invités : `docs/audit/rsvp-ticket-validation.json`. Journal privé : `.qa-artifacts/rsvp-verify.log`.
Les deux clusters PostgreSQL temporaires ont été arrêtés ; leurs mots de passe temporaires ont été supprimés.

## Commandes minimales

Depuis le dossier du projet :

```powershell
npm run dev
```

Ouvrir http://127.0.0.1:3000/. Ce mode utilise réellement Supabase ; une confirmation valide y écrit réellement.

```powershell
npm run verify
npm run build
```

`npm run inspect:tickets` vérifie les prérequis sans créer de billet et retourne un code non nul s'ils manquent.
`npm run test:concurrency` rejoue le test sur PostgreSQL 16 local temporaire.

## Avant les vrais billets

- Autoriser/appliquer 004 après sauvegarde et inspection, sans autre migration.
- Configurer Google privé et vérifier l'absence de partage public.
- Générer les vrais billets depuis le domaine HTTPS final : une carte téléchargée sur localhost pointe vers localhost.
- Tester personnellement iPhone, Android, re-scan et panne.
- Contrôler les noms composés et ambiguïtés avec l'organisateur ; conserver leur forme pendant les admissions.
- Effectuer vous-même le push GitHub et le déploiement Vercel.

Sources : [authentification Google serveur](https://developers.google.com/identity/protocols/oauth2/service-account), [quotas Sheets](https://developers.google.com/workspace/sheets/api/limits), [Sec-Fetch-User et compatibilité](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-User).

## Fichiers modifiés

La liste ci-dessous exclut le changement préexistant de `.gitignore`, conservé sans intervention.
Les données privées, classeurs et sauvegardes restent hors Git.
- `.env.example`
- `MARIAGE-README.md`
- `docs/FICHIERS-MODIFIES.md`
- `package-lock.json`
- `package.json`
- `scripts/check-frontend-secrets.mjs`
- `server/index.mjs`
- `serverless/handler.mjs`
- `serverless/repository.mjs`
- `serverless/validation.mjs`
- `src/components/RsvpSection.tsx`
- `src/lib/api.ts`
- `src/lib/tickets.ts`
- `src/lib/types.ts`
- `tests/api.test.mjs`
- `tests/database.mjs`
- `tests/ticket.test.mjs`
- `docs/RSVP-QR-FINALISATION.md`
- `docs/audit/rsvp-ticket-validation.json`
- `scripts/inspect-ticket-readiness.mjs`
- `scripts/test-ticket-concurrency.mjs`
- `serverless/official-list.mjs`
- `serverless/ticket-page.mjs`
- `supabase/activation/inspect-ticket-entry-readonly.sql`
- `supabase/activation/rollback-ticket-entry.sql`
- `supabase/migrations/004_ticket_entry.sql`
- `tests/browser-fixture.mjs`
- `tests/ticket-entry.test.mjs`
