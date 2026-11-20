# Livraison intégrée du 20 novembre 2026 — Alicia & Jeff

Dossier : C:/Users/Hp EliteBook/Downloads/alicia-jeff-site-local-v3. Base Git : main, 8f4e9b7.
Ce rapport remplace le bilan de livraison précédent. Les rapports datés antérieurs restent des archives.
**Campagne locale réalisée ; validation complète en production encore requise. Le projet n’est pas déclaré terminé.**
Aucun commit, push, déploiement, changement de secret, permission hébergée ou migration distante effectué pendant cette campagne.

## Audit et corrections

| Problème constaté | Correction locale | Limite ou dépendance |
| --- | --- | --- |
| Diagnostic Google réservé admin, aucun admin distant et un photographe | Délégation HMAC temporaire pour le compte exact du propriétaire authentifié ; scope unique ; dix minutes ; audit sans donnée personnelle | Nouveau code à déployer par le propriétaire ; chaîne Google réelle à tester |
| Finalisation des imports avec hidden=false : publication immédiate possible dans un album déjà ouvert | Deux nouvelles fonctions SQL service-only finalisent hidden=true ; backend refuse l’import si elles manquent | Migration 005 préparée, absente à distance ; nouvel accord explicite nécessaire |
| Panneau photographe intégré à l’invitation, publication peu explicite | Page /photographe distincte, connexion/session, aperçus avant transfert, sélection, import en brouillon, bouton Publier les photos, gestion des albums/photos/messages | Auth et Storage réels restent à contrôler dans un environnement autorisé |
| Album public ouvert ne montrait pas immédiatement les changements | Métadonnées rechargées toutes les 30 secondes, puis photos relues si modification ; vide/erreur/pagination conservés | URL signées déjà émises valables jusqu’à dix minutes |
| Accessibilité et lecture mobile | Contrastes des commandes, focus, piège clavier enveloppe/lightbox, retour du focus, onglets clavier, petits écrans ; titre du compte à rebours et colonnes des lieux corrigés après débordements réels à 320 px | Test tactile natif sur les téléphones du propriétaire restant |
| Chargement initial important | Page photographe et client Supabase chargés à la demande ; PDF toujours chargé à la demande | Bundles PDF restent volumineux mais absents du parcours initial |
| Risque de confusion entre versions testées | Identifiant finalisation-20261120 partagé par health, build et serveur local | Production affiche encore rsvp-qr-20261119 avant déploiement |

Le RSVP existant reste individuel : aucun sélecteur de personnes, serveur impose participants=1, liste officielle jamais consultée à la confirmation.
Téléchargement automatique et bouton de secours conservés ; un échec de téléchargement n’annule pas la confirmation ; restauration après rechargement conservée.
Le QR contient un lien HTTPS avec référence opaque, sans nom. GET présente uniquement la page ; seul POST avec preuve d’interaction effectue le contrôle.
Comparaison exacte serveur après accents/casse/espaces normalisés, ordre mixte explicite, homonymes et indisponibilités refusés.
Google est consulté avant l’opération atomique d’entrée : panne STS/IAM/Sheets ne consomme pas le billet. La migration 004 et ses contraintes sont préservées.

## État par fonctionnalité

| Fonctionnalité | État | Preuve et périmètre |
| --- | --- | --- |
| Invitation, ouverture, compte à rebours, navigation et responsive | Validée réellement | Navigateur Edge installé, build local, huit largeurs ; effets audio/tactiles natifs restant à apprécier sur téléphone |
| RSVP individuel, PDF automatique/secours/rechargement | Validée réellement en environnement isolé | Navigateur réel, handler réel et SQL PGlite ; pas de confirmation fictive hébergée |
| QR valide/inconnu/absent/déjà utilisé et panne Google | Validée réellement en environnement isolé | API/SQL réels ; transports Google contrôlés ; décodage QR et protections aperçus couverts par tests |
| Anti-double entrée concurrente | Validée réellement en environnement isolé | PostgreSQL 16, deux connexions indépendantes, billet identique puis même personne sur deux billets |
| Protection admin et cron anonymes hébergés | Validée réellement | Production : admin/state 401 ; cron 401 ; GET tickets/verify 405 |
| Lecture Supabase publique / compatibilité six tables et bucket privé | Validée réellement en lecture seule | verify:runtime ; aucune création ou modification distante |
| Photographe : connexion, import, publication et galerie | Corrigée mais en attente de test de production | Parcours navigateur complet sur vrai SQL/API local ; Auth et transport Storage simulés |
| Import privé garanti en Production | Bloquée | 005 absente (PGRST202 sur le marqueur) ; migration non autorisée ni exécutée pendant cette campagne |
| Délégation temporaire propriétaire | Corrigée mais en attente de test de production | Tests de signature/compte/expiration et parcours navigateur ; aucun vrai jeton propriétaire créé |
| OIDC → STS → IAM → feuille privée | Bloquée | Nécessite requête Production du propriétaire après déploiement ; ancien diagnostic OIDC positif rapporté par le propriétaire, pas une preuve de lecture Sheets |
| Catalogue SQL/RLS hébergé actualisé | Bloquée | MCP lecture seule : OAuth token refresh failed: Failed to parse server response. Exports locaux et tests ACL disponibles, aucune conclusion de catalogue distant récent |

## Contrôles exécutés

La commande complète npm run verify:delivery a terminé avec le code 0 sur le dernier état : voir .qa-artifacts/finalisation-20261120/verify-delivery-complete.log.
La preuve structurée docs/audit/finalisation-20261120.json contient les nombres et résultats finaux.
Les résultats détaillés et captures sont dans .qa-artifacts/finalisation-20261120, ignoré par Git.
Comptages finaux : 7 tests du serveur historique, 215 tests API/SQL/sécurité, 7 assertions UX, 16 contrôles du runtime, 31 contrôles fonctionnels navigateur et 24 contrôles responsive (trois états × huit largeurs).
TypeScript, ESLint, build et scan des 11 artefacts texte frontend réussissent. Les mouvements sont réduits dans les tests navigateur ; les effets dynamiques et l’écoute audio native ne sont pas prétendus vérifiés exhaustivement par ces captures.
Les tests navigateur bloquent les requêtes externes : aucune authentification réelle ni mutation hébergée n’est simulée comme un succès de production.
Les échecs intermédiaires de sélecteur et de débordement responsive ont été corrigés ; les résultats finaux font foi.

| Contrôle | Nature |
| --- | --- |
| npm run verify:delivery | TypeScript, ESLint, tests serveur/API/UX, build, scan frontend, runtime local et navigateur |
| npm run test:concurrency | PostgreSQL 16 isolé avec connexions concurrentes ; aucun accès hébergé d’écriture |
| npm audit --omit=dev | Zéro vulnérabilité connue remontée au moment du contrôle ; dépendances de production |
| Production HTTP anonyme | Health 200 ; API admin 401 ; scan GET 405 ; cron sans Bearer 401 |
| Supabase existant | Lecture réelle, bucket privé ; zéro admin et un photographe ; sept photos historiques conservées |

La galerie distante est autorisée mais sa date existante reste le 18 décembre 2026 à 15 h UTC. Elle est donc indisponible aujourd’hui par configuration, pas par panne.
Aucun horaire, droit ou état de publication distant n’a été changé pour faire réussir un test.

## Sécurité et risques résiduels

- RLS et droits SQL sont deux conditions distinctes. Les exports Storage indiquent un bucket privé et aucune politique ouvrant directement les objets aux visiteurs ; les grants seuls ne prouvent aucun accès. Un nouveau contrôle du catalogue distant reste nécessaire avant modification de permissions.
- Les liens signés sont des capacités temporaires : masquer une photo retire les futurs liens mais ne révoque pas instantanément ceux déjà remis, durée maximale dix minutes.
- Le diagnostic Google garde sa fenêtre Production explicite et son cooldown par instance, sans compteur Supabase ni écriture. Ce n’est pas une limite globale distribuée. La délégation est réutilisable pendant dix minutes, liée au compte et à ce seul endpoint ; maximum quinze minutes imposé côté serveur.
- La délégation utilise la clé serveur déjà détenue localement, avec séparation de domaine HMAC ; aucun nouveau secret permanent ni rôle administrateur n’est créé. Fichier privé ignoré par Git, jeton jamais imprimé, chargé en mémoire de l’interface uniquement.
- Limites d’ingestion : formats JPEG/PNG/WebP, vingt MiB par fichier côté serveur et contrôle réel du contenu ; sélection de cent fichiers et deux cents MiB par lot côté interface, deux transferts parallèles. Limites de lots côté interface ne remplacent pas quotas/rate limits serveur.
- Sans connexion vigile, la possession du lien du billet et une navigation utilisateur reconnue ou un clic de vérification suffisent pour déclencher sa vérification : ne pas partager le billet. Le contrôle anti-aperçu empêche un GET de consommer l’entrée, sans constituer une authentification du vigile.
- La caméra native et les prévisualisations mobiles ne sont pas reproduites par Edge headless ; un scan final depuis le PDF de Production est nécessaire. Aucun GET ne consomme une entrée. Une navigation utilisateur reconnue peut lancer le POST automatiquement après 700 ms ; sinon le bouton de vérification exige un clic réel. Les aperçus identifiés et le préchargement restent exclus.
- Le build prévient que l’image d’enveloppe est copiée après Vite. Le script de copie fournit effectivement le fichier dans dist ; les tests de ressources et le navigateur vérifient le résultat final.

## Migration 005 préparée, non exécutée

Fichier : supabase/migrations/005_draft_uploads.sql. Ajoute seulement wedding_api_upload_complete_draft(uuid,uuid,uuid) et wedding_api_upload_draft_ready().
SECURITY INVOKER, search_path fixé à pg_catalog,pg_temp, EXECUTE révoqué à PUBLIC/anon/authenticated et accordé à service_role ; contrôles de rôle, bail, nonce et verrouillage conservés.
Aucune table, ligne, ancienne fonction, permission Auth/Storage ou politique RLS modifiée. Tests d’idempotence et conservation de la fonction originale et des données exécutés localement.
Précontrôle en lecture seule : supabase/activation/inspect-draft-uploads-readonly.sql.
Rollback manuel dédié : supabase/activation/rollback-draft-uploads.sql, retire seulement les deux nouvelles fonctions et conserve photos/brouillons/intents/RSVP.
Ne jamais lancer de rollback automatique en cas de divergence. Ne pas rejouer 004 ni 001–003.
Les sauvegardes historiques restent hors Git. Elles ne remplacent pas une sauvegarde actuelle et cohérente avant l’intervention autorisée ; la sauvegarde REST existante ne capture ni ACL ni fonctions et n’est pas transactionnelle.

## Liste unique de validation et mise en service

1. **Accord du propriétaire sur 005 uniquement.** Avant toute exécution, dans le bon projet Supabase, conserver une sauvegarde actuelle et les résultats du précontrôle hors Git. Vérifier les deux fonctions absentes, les prérequis, RLS et droits ; si elles existent déjà ou divergent, arrêter. Après accord, appliquer seulement 005, puis comparer définitions/ACL/RLS et vérifier EXECUTE service-only, sans test écrivant de fausses photos. Conserver le rollback dédié sans l’exécuter automatiquement.
2. **Commit/push/déploiement par le propriétaire après 005.** Inclure seulement les fichiers de docs/FICHIERS-MODIFIES.md, vérifier les exclusions et exécuter verify:delivery. Un push main peut déclencher Vercel automatiquement : choisir le moment avec soin. Conserver la configuration Vite/Node 22/API et les identités OIDC Production existantes. Vérifier health.release=finalisation-20261120 et /photographe ; ne pas créer de variables VERCEL artificielles.
3. **Validation Google privée, sans billet.** Vérifier les variables temporaires GOOGLE_SHEETS_READINESS_ENABLED=true et GOOGLE_SHEETS_READINESS_UNTIL avec échéance UTC courte au déploiement. Depuis le dossier local, créer la délégation pour le propre compte Auth du propriétaire (guide Google), se connecter à /photographe, charger le fichier privé et lancer OIDC puis Google Sheets. Attendre ready=true et sheets_readable=true ; aucun contenu de feuille retourné. En cas d’échec rester en refus sécurisé ; aucune permission Google à assouplir.
4. **Validation humaine des intégrations.** Connexion/déconnexion réelles, rôle refusé hors staff ; import d’une photo consentie en environnement approprié, brouillon invisible, publication explicite, visibilité après ouverture configurée, masquage. Parcours RSVP/PDF/QR sur un invité réel consenti dans un cadre approprié ; un scan reconnu consomme l’entrée, donc ne pas utiliser de billet réel comme simple diagnostic. Vérifier caméra native et audio sur téléphone. Toute mutation de production supplémentaire nécessite autorisation adaptée.
5. **Fermeture du diagnostic et décision finale.** Laisser expirer la délégation et la fenêtre ; retirer l’activation lors d’un déploiement ultérieur ou supprimer le diagnostic. Confirmer les résultats ci-dessus avant de déclarer la mise en service complète. Aucun de ces contrôles externes n’est prétendu effectué par la livraison locale.

## Commandes minimales

Depuis le dossier du projet : npm run dev (invitation et API sur le port 3000), npm run verify:delivery (vérification complète), npm run build (production).
Le développement normal utilise le vrai Supabase de .env.local ; les soumissions valides y écrivent. Les tests automatisés utilisent des bases isolées et des services externes contrôlés.
Le test navigateur requiert Edge installé ; Chrome peut être sélectionné par WEDDING_BROWSER_CHANNEL=chrome. Aucun navigateur ni pilote supplémentaire n’est téléchargé par le script.


## Préparation finale de 005 — contrôle du 20 novembre 2026

**Aucune opération d’écriture distante réalisée.** Le fichier original 005 reste strictement inchangé.
Chemin : C:/Users/Hp EliteBook/Downloads/alicia-jeff-site-local-v3/supabase/migrations/005_draft_uploads.sql.
SHA-256 : 6cdd11593eca2d970c132fe112be716b36df02e63ffd1822dfb7b758e3499d95.
004 conserve son empreinte 6308483d162d805f019b607335f128446251e8eec33392102a0c25fe99ab53cf.

### Résultat de la revue

005 ajoute seulement deux fonctions : wedding_api_upload_complete_draft(uuid,uuid,uuid) et wedding_api_upload_draft_ready().
Aucune table, index, ancienne fonction, politique RLS, permission métier existante, configuration Auth ou Storage n’est modifié.
Les INSERT/UPDATE présents dans le texte sont les instructions du corps de la nouvelle fonction, exécutées seulement lors d’un import futur ; la migration ne les appelle pas.
Les quatre fonctions de 004, les contraintes des billets, les RSVP existants et leurs références restent inchangés dans les tests avant/après.
Le nouveau finaliseur impose hidden=true, conserve le verrouillage, le nonce, le bail, l’identité du photographe et l’idempotence de l’import.
Le marqueur est une lecture booléenne. Fonctions INVOKER, search_path pg_catalog,pg_temp et EXECUTE service_role, sans accès anon/authenticated/PUBLIC.
Le propriétaire PostgreSQL conserve les privilèges inhérents de propriétaire ; service-only désigne les rôles applicatifs, pas une exclusion du propriétaire de la base.

Le connecteur supabase_alicia_jeff_readonly n’a pas permis de rafraîchir le catalogue :
OAuth token refresh failed: Failed to parse server response.
L’état distant actuel ne doit donc pas être présumé. Les vérifications ci-dessous dans SQL Editor sont obligatoires.
Le nom de projet attendu inscrit dans une capture est un libellé de préparation, PAS une preuve de provenance : vérifier l’adresse du tableau de bord, projet mcnpagbcehupdbhshcea.

### Sauvegarde et garde d’application

Le générateur scripts/prepare-migration005.mjs est entièrement hors ligne : aucun client Supabase, aucun secret chargé, aucune requête réseau et aucune possibilité d’appliquer une migration.
Il produit un lot privé unique sous .qa-artifacts, avec SQL de sauvegarde, copie exacte de 005, rollback dédié et manifeste SHA-256 des migrations 001–004.
La requête de capture est aussi consultable dans supabase/activation/migration005-backup-readonly.sql.

La capture utilise une transaction REPEATABLE READ READ ONLY et row_security=off : avec un rôle insuffisant, elle échoue plutôt que de produire silencieusement une sauvegarde filtrée.
Exécuter avec le rôle postgres dans SQL Editor. Elle conserve en une capture cohérente les neuf tables applicatives (six métier, deux de coordination, billets), les fonctions, contraintes, index, ACL, politiques RLS et métadonnées nécessaires.
Les noms, messages et références de billets sont privés : exporter uniquement dans le dossier du lot, jamais dans le chat ou Git. Conserver ce dossier sur un poste privé sécurisé.
Ce n’est pas un backup physique complet du projet : ni utilisateurs Auth ni fichiers binaires Storage, qui ne sont pas modifiés par 005.
Le générateur prépare le mécanisme ; aucune sauvegarde réelle de Production n’a été prise par l’assistant pendant cette étape. Les exports restent à réaliser dans SQL Editor.

La phase before lit l’export JSON ou CSV Supabase (une ligne, colonne snapshot), vérifie son intégrité et son contenu, la présence enregistrée de 004, les corps des quatre fonctions, leurs permissions et les contraintes principales des billets.
Elle impose les prérequis upload et RLS, l’absence des deux nouvelles fonctions, et refuse des privilèges par défaut inattendus.
Elle prépare seulement après succès apply005-after-approval.sql : le SQL original 005, avec un bloc supplémentaire de lecture du catalogue, une échéance de trente minutes et des timeouts locaux (verrou cinq secondes, instruction trente secondes).
Cette enveloppe crée les mêmes deux fonctions ; elle ne retire pas BEGIN/COMMIT et n’ajoute aucun autre objet. Elle refuse atomiquement tout nom de fonction de 005 déjà présent, y compris une surcharge, au lieu d’écraser une installation existante.
Si la fenêtre expire, préparer un nouveau lot et refaire uniquement la capture et sa validation ; ne jamais antidater ni supprimer la garde.

### Procédure PowerShell / SQL Editor

Dans PowerShell, préparer le lot (aucune connexion distante) :

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3'
$lot005 = node scripts/prepare-migration005.mjs prepare | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Preparation 005 refusee.' }
Get-Content -LiteralPath $lot005.backup_sql -Raw | Set-Clipboard
$lot005.directory
```

Ouvrir https://supabase.com/dashboard/project/mcnpagbcehupdbhshcea/sql/new, vérifier le projet et le rôle postgres.
Coller le SQL de sauvegarde en lecture seule, exécuter et exporter l’unique résultat snapshot en CSV complet dans le dossier affiché, nom before.csv.
Ne pas exporter uniquement les lignes visibles d’un tableau : le résultat doit contenir la cellule JSON entière.

```powershell
$avant005 = Join-Path $lot005.directory 'before.csv'
node scripts/prepare-migration005.mjs before --bundle $lot005.directory --snapshot $avant005
if ($LASTEXITCODE -ne 0) { throw 'Precontrole refuse : ne rien appliquer.' }
```

**ARRÊT POUR VALIDATION : demander l’autorisation finale de l’application 005 et de sa garde de livraison. Aucun SQL d’écriture ne doit être exécuté pendant la préparation.**
Suspendre les imports du photographe pendant la séquence migration → déploiement ; ne pas modifier les RSVP pour préparer la livraison.
Après autorisation seulement, copier le fichier validé puis l’exécuter intégralement dans le même projet SQL Editor, en une seule exécution :

```powershell
Get-Content -LiteralPath (Join-Path $lot005.directory 'apply005-after-approval.sql') -Raw | Set-Clipboard
```

Si une instruction échoue, arrêter et conserver l’erreur exacte. Ne pas retenter automatiquement. Vérifier l’état de la transaction et les objets avant toute nouvelle action.
La transaction rend l’installation atomique lorsqu’elle est exécutée comme un seul script ; ne pas lancer les instructions une par une.
Ne pas exécuter le rollback destructif par automatisme.

Après succès, copier de nouveau le SQL de capture en lecture seule :

```powershell
Get-Content -LiteralPath $lot005.backup_sql -Raw | Set-Clipboard
```

Dans SQL Editor, exécuter cette capture et exporter le résultat complet dans after.csv, dans le même dossier. Ensuite seulement :

```powershell
$apres005 = Join-Path $lot005.directory 'after.csv'
node scripts/prepare-migration005.mjs after --bundle $lot005.directory --snapshot $apres005
if ($LASTEXITCODE -ne 0) { throw 'Verification refusee : diagnostic avant toute autre action.' }
```

Le résultat doit afficher ready=true, metadata_unchanged=true et data_unchanged=true. Aucun nom, ligne ou jeton n’est affiché par le validateur.
Un code 2 signale des données modifiées entre les captures : cela peut provenir de trafic légitime (RSVP, compteurs, nettoyage). Stopper la validation et diagnostiquer ; ne jamais restaurer une ancienne capture en écrasant ces données.
Le code 1 signale un export inexploitable, une divergence de schéma/permissions/fonctions ou une intégrité invalide.
Contrôle réel final du marqueur, sans créer de photo ni invité :

```sql
begin read only;
set local role service_role;
select public.wedding_api_upload_draft_ready() as draft_uploads_ready;
commit;
```

Résultat attendu : true. Les captures before/after vérifient EXECUTE=false pour anon et authenticated et true pour service_role, les définitions exactes, INVOKER, search_path, ainsi que les protections intactes de 004.
SQL Editor n’inscrit pas automatiquement cette exécution dans supabase_migrations.schema_migrations. La preuve de 005 est ici la comparaison des objets et le lot d’exécution privé ; ne pas rejouer 005 à cause de l’absence d’une ligne d’historique et ne pas écrire manuellement dans l’historique sans nouvelle revue/autorisation.
Si un runner apply_migration est préféré, adapter et comparer séparément ses délimitations transactionnelles avant emploi ; le lot SQL Editor ne doit pas être injecté aveuglément dans un autre runner.

### Rollback et séquence finale unique

Le rollback privé rollback-manual.sql correspond à supabase/activation/rollback-draft-uploads.sql : DROP des deux nouvelles fonctions uniquement, sans CASCADE.
Il conserve toutes les données et fonctions de 004. Avec le nouveau backend déployé, son application désactiverait les nouveaux imports : diagnostic et accord explicite obligatoires avant de l’envisager.
Après approbation puis succès de 005 et des contrôles : npm run verify:delivery, revue de l’inventaire Git actualisé, commit/push/déploiement par le propriétaire à un moment convenu, puis validation Production groupée Google/Auth/Storage/RSVP/QR décrite plus haut.
L’ancien backend conserve son finaliseur historique : la garantie de brouillon ne devient effective pour les nouveaux imports qu’après déploiement du nouveau backend. Conserver les imports en pause pendant cet intervalle.
La préparation de 005 n’autorise ni commit, ni push, ni déploiement ; aucune de ces actions n’a été réalisée ici.

Tests ciblés de cette préparation : 47 tests réussis, dont sauvegarde SQL/CSV/JSON, CLI hors ligne, maintien de 004/données/ACL, refus de rejeu, brouillon/publication, contrôles API, RSVP et billets. ESLint réussi.
Preuve locale ignorée : .qa-artifacts/finalisation-20261120/migration005-preparation-tests.log.

Référence officielle sur le suivi des migrations et les changements directs SQL Editor : https://supabase.com/docs/guides/deployment/database-migrations .
Le validateur final a été rejoué après durcissement des contrôles de propriétaire, arguments, configuration et intégrité du modèle : 3/3 réussis.
