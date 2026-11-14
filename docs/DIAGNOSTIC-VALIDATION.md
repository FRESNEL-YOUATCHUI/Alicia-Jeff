# Diagnostic, corrections et validation — Alicia & Jeff

Date de livraison : 14 novembre 2026, UTC. Dossier : `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`. Branche locale : `codex/supabase-vercel-finalisation`.

**État : démarrage Windows corrigé et testé, frontend accessible, administration anonyme en 401, aucune erreur de passerelle observée après correction. La validation fonctionnelle hébergée reste bloquée par l’absence des RPC Supabase.** Aucune migration, permission, donnée réelle, clé, configuration de production, opération GitHub ou déploiement n’a été modifié à distance.

## A. Diagnostic et preuves

### 1. Détection Node dans Vercel

Le lanceur transmettait `VERCEL_VC_NATIVE: '0'`. Dans la version installée de `@vercel/build-utils/dist/get-node-exec-path.js`, le test est un test de présence/truthiness, pas une comparaison à `'1'`. La chaîne `'0'` active donc le chemin de recherche réservé au CLI natif.

Ce détecteur exclut le chemin de `process.execPath`, car un vrai CLI autonome ne doit pas être pris pour Node. Dans le lanceur JavaScript, `process.execPath` est pourtant déjà Node. Avec un PATH contenant uniquement cette installation, tous les candidats sont écartés et le détecteur lève exactement `Could not find the Node.js executable in PATH.`. Avoir un `node --version` et des processus enfants fonctionnels n’exclut donc pas cette erreur.

**Reproduction exécutée :** processus enfant avec PATH restreint à une installation Node : ancien drapeau = échec, drapeau absent = succès, environnement corrigé = succès avec le Node courant. Le PATH global Windows n’a pas été modifié. Sur un PATH contenant une autre installation Node, l’ancien comportement peut sélectionner cette autre installation au lieu d’échouer ; la reproduction contrôlée évite de confondre ces cas.

Correction : retirer les drapeaux natifs du processus JavaScript, définir `VERCEL_NODE_EXEC_PATH` au chemin absolu courant et préparer un PATH enfant cohérent. Le code interne du CLI n’a pas été modifié.

### 2. Port Vite imposé

Au début de cette intervention, `scripts/vite-vercel.mjs` était modifié pour forcer 5174. Le lancement reproduit affichait Vite prêt sur 5174 mais n’achevait pas l’initialisation Vercel. Vercel attend le port qu’il attribue au dev command.

Après correction, Vercel a fourni le port interne 3000, le frontend y a démarré, le CLI a annoncé Ready et **huit contrôles HTTP réels sont passés**. Voir `docs/audit/vercel-readonly.json`. Le fait que le port attribué soit 3000 n’est pas, à lui seul, un conflit : il faut respecter le mécanisme d’intégration du CLI plutôt que choisir un autre port arbitrairement.

### 3. Environnement et deux erreurs 503 distinctes

`configuration_required` est produit par `serverless/supabase.mjs` lorsque la configuration serveur n’est pas disponible/valide. La présence des variables dans un fichier ne prouve pas leur présence dans un processus enfant. Le chargement est désormais explicite, fondé sur le chemin du projet et indépendant du dossier de lancement ; les valeurs déjà définies dans le processus gardent priorité.

Le diagnostic actuel confirme les quatre variables obligatoires et des URL frontend/backend concordantes, sans enregistrer leurs valeurs. Les vérifications réelles atteignent Supabase Auth et la Data API.

**Le 503 restant est `schema_required`, pas `configuration_required`.** La requête de lecture des souvenirs atteint Supabase, mais les fonctions `wedding_api_*` nécessaires ne sont pas installées. Les principales colonnes des six tables ont été vérifiées par des requêtes `limit=0` ; le bucket privé est confirmé. L’absence de RPC n’est pas résolue par un changement de port ou une réinstallation Windows.

### 4. Lint absent et gestion des processus

`npm run lint` échouait car aucun `eslint.config.*` n’était présent pour ESLint 9. Une configuration complète JS/TypeScript et React Hooks est ajoutée. Les sept erreurs ensuite identifiées ont été corrigées, sans retirer d’assertion ni supprimer de test.

Les lanceurs historiques ne géraient pas tous les erreurs de spawn, codes de sortie et descendants. Le démarrage recommandé n’a plus de processus serveur Vite distinct : Node et Vite middleware partagent un port. Le mode Vercel conserve une fermeture de son propre arbre de processus sous Windows. Les ports occupés produisent une erreur lisible et l’arrêt/reprise sur le même port est testé.

## B. Corrections effectuées

| Fichiers | Changement |
| --- | --- |
| `scripts/dev-local.mjs`, `scripts/lib/local-app.mjs` | Une commande, un port, Vite middleware/HMR et le gateway réel ; fermeture propre, port occupé, erreurs structurées, protection des fichiers privés. |
| `scripts/lib/environment.mjs` | Lecture locale déterministe de .env.local, priorité des valeurs existantes, validation des ports, environnement enfant Vercel corrigé. |
| `scripts/vercel-dev.mjs`, `scripts/vite-vercel.mjs`, `scripts/lib/processes.mjs` | Node absolu, drapeaux natifs retirés, port Vercel respecté, erreurs et arrêt des seuls descendants créés. |
| `scripts/verify.mjs`, `scripts/lib/checks.mjs` | Pipeline de vérification unique ; arrêt au premier échec et à l’annulation, code non nul conservé. |
| `scripts/diagnose-runtime.mjs` | Reproduction automatisée de la panne Node et contrôle de configuration sans secrets. |
| `scripts/verify-runtime.mjs`, `scripts/check-supabase-compatibility.mjs` | Vrais handlers, quinze contrôles HTTP, tables limit=0, bucket privé et disponibilité réelle des RPC. Aucun faux backend. |
| `eslint.config.mjs` | Configuration recommandée ESLint 9 / TypeScript / React Hooks ; contrôle du code source, serveur, scripts et tests. |
| `serverless/supabase.mjs`, `serverless/handler.mjs` | Extraction/validation du Bearer avant configuration pour garantir 401 sans authentification ; vérification Auth et rôle conservée pour les requêtes authentifiées. |
| `serverless/validation.mjs` | Contrôle des caractères interdits exprimé sans regex de contrôle et vérification explicite des séparateurs de fichiers ; limites et protections conservées. |
| `serverless/storage.mjs`, `tests/api.test.mjs`, `scripts/configure-storage.mjs` | Variables/imports inutilisés corrigés ; aucun changement des règles Storage et aucune utilisation de --apply. |
| `src/lib/tickets.ts` | Déclaration de tableau passée de let à const uniquement ; rendu et QR inchangés. |
| `server/server.test.mjs` | Garde de chemin de nettoyage exprimé par assertion équivalente, avant suppression du dossier de test ; même condition de sécurité, assertions conservées. |
| `scripts/check-preserved-files.mjs` | Les deux ajustements de maintenance ci-dessus sont explicitement reconnus ; tout autre changement du contenu contrôlé reste détecté. |
| `vite.config.ts` | Fichiers privés refusés, y compris via les accès filesystem Vite ; ancien proxy toujours activé uniquement pour son mode explicite. |
| `package.json`, `package-lock.json` | Commandes verify/diagnose, Node 22 déclaré ; aucune nouvelle dépendance ajoutée pour ces corrections. |
| `scripts/prepare-supabase-activation.mjs`, `supabase/activation/activate-serverless.sql` | Activation 001+002 préparée dans une seule transaction avec références aux sources. Aucun SQL exécuté sur le projet hébergé. |
| `tests/runtime.test.mjs`, `tests/activation.test.mjs` | Régressions Node/ports/processus/401, échec et annulation de verify ; rejouabilité et rollback atomique SQL sur données synthétiques. |

Liste exhaustive des fichiers et preuves : `docs/FICHIERS-MODIFIES.md`. La modification préexistante de `.gitignore` est conservée hors du commit. La modification préexistante de `vite-vercel.mjs` est corrigée dans le périmètre demandé. Aucun secret existant n’est modifié.

## C. Tests exécutés et limites

| Contrôle | Résultat réel | Limite |
| --- | --- | --- |
| `npm run typecheck` | Réussi | Frontend TypeScript. |
| `npm run lint` | Réussi, aucune erreur | Configuration complète ajoutée puis erreurs corrigées. |
| `npm run build` | Réussi | Avertissement connu sur l’image d’enveloppe, copiée ensuite avec les médias ; chargement HTTP confirmé. |
| `npm test` | 7 tests historiques + 49 tests API/SQL/runtime réussis ; 7 assertions de défilement réussies | PostgreSQL isolé pour les mutations et rôles valides simulés ; aucun succès hébergé fictif. |
| `npm run check:secrets` | Réussi, 7 artifacts texte contrôlés | Ne constitue pas un audit de tous les anciens journaux externes. |
| `npm run diagnose` | Réussi ; défaut Node reproduit et environnement corrigé validé | PATH du test enfant uniquement. |
| `npm run verify` | **Code 1 à la dernière étape : schema_required** | Échec restant explicite, pas un résultat artificiellement vert. |
| Runtime recommandé | 15 contrôles HTTP réussis ; /api/admin/state anonyme = 401, jeton invalide = 401, API inconnue = JSON 404, saisies invalides = 400, ressources = 200, fichiers privés = 404 | Lecture réelle Supabase ; aucune requête de création valide envoyée. |
| Vercel Dev corrigé | 8 contrôles HTTP réussis, sans 502 observé | Persistances toujours bloquées par les RPC absentes. |
| Schéma Supabase réel | Six tables compatibles, 31 colonnes utilisées vérifiées avec limit=0 ; bucket privé | Pas de lecture de lignes d’invités, contraintes analysées à partir des exports. |
| Navigateur réel local | Enveloppe, navigation, 3 images, musique, compteur, volets Souvenirs et formulaire de connexion ; 1440/390 px sans débordement horizontal | Message d’indisponibilité RPC visible ; aucune exception JavaScript bloquante observée. |
| Rôles, albums, modération, RSVP, QR, format d’image et imports | Tests isolés réussis | Le vrai compte photographe n’a pas été utilisé ; aucun identifiant de connexion de test fourni. |
| Activation groupée | Rejouabilité et conservation des albums, rollback intégral si le précontrôle des permissions échoue | Base locale synthétique uniquement. |

**Non validés sur Supabase hébergé :** connexion/déconnexion avec le vrai compte, lecture admin avec un jeton valide, création/renommage d’album, upload/finalisation Storage, publication/masquage, RSVP/message valide et téléchargement du billet après un vrai RSVP. Ces opérations nécessitent l’activation autorisée des RPC et, pour les écritures, un environnement de test approprié. Les tests isolés ne les remplacent pas.

Preuves sans secrets : `docs/audit/runtime-diagnostic.json`, `local-runtime.json`, `browser-validation.json`, `vercel-readonly.json` et `preserved-files.json`. Les détails SQL/RLS figurent dans `SECURITE-SUPABASE.md` : les grants Storage ne sont pas confondus avec une autorisation RLS.

### Différences entre les deux modes locaux

Le mode recommandé exécute le même `api/gateway.mjs` et les mêmes modules que Vercel, avec les vrais services Supabase. Il ne reproduit pas la sandbox, les limites mémoire/durée, le CDN, les crons ni tous les en-têtes injectés par Vercel. Il ne fait confiance à aucun en-tête de provenance Vercel fourni par le navigateur local. La requête de gateway réécrite est testée en HTTP et readJson accepte à la fois les corps Node bruts et les corps déjà analysés.

Les caches des vérifications sur port temporaire sont isolés du cache du serveur utilisé pour la navigation. Le mode Vercel est conservé pour contrôler l’adaptateur, mais il n’est plus nécessaire au démarrage quotidien.

## D. Configuration requise

Aucune valeur secrète n’est inscrite ici :

| Variable | Usage |
| --- | --- |
| `VITE_SUPABASE_URL` | URL publique du frontend. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique frontend. |
| `SUPABASE_URL` | Backend uniquement. |
| `SUPABASE_SECRET_KEY` | Backend uniquement ; jamais préfixée VITE_. |
| `CRON_SECRET` | Secret serveur distinct pour le nettoyage planifié ; pas requis pour ouvrir le site localement. |
| `PORT` | Option locale facultative ; défaut 3000. Dans dev:vercel, le port du dev command est fourni par le CLI. |

Les quatre variables Supabase présentes ont été vérifiées sans afficher leur contenu. Le code charge .env.local localement ; Vercel doit recevoir ses variables dans ses propres environnements Development/Preview/Production lors de votre futur déploiement. Les secrets, données historiques et artifacts temporaires restent ignorés par Git.

## E. Trois commandes finales

Depuis `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3` :

```powershell
npm run dev
npm run verify
npm run build
```

La première sert **http://127.0.0.1:3000/**. La deuxième est stricte et retourne actuellement 1 tant que le schéma applicatif n’est pas activé. La troisième prépare les fichiers de production. Aucun push ni déploiement n’est déclenché par ces commandes.

## F. Validation personnelle avant déploiement

- [ ] Autoriser l’activation transactionnelle de `supabase/activation/activate-serverless.sql` : RPC, deux tables de coordination et droits métier. Aucune suppression des six tables/albums ni modification des politiques Storage ; 003 reste une décision séparée.
- [ ] Après activation, obtenir `npm run verify` sans échec et vérifier avec le compte photographe les trois albums et leurs identifiants.
- [ ] Dans un contexte de test autorisé, contrôler un RSVP/billet, un message/modération, une photo/import interrompu puis reprise, publication/masquage et refus d’un compte sans rôle.
- [ ] Valider les limites du bucket privé (20 MiB, JPEG/PNG/WebP) et configurer les variables distantes, dont CRON_SECRET si le nettoyage planifié est utilisé.
- [ ] Effectuer vous-même le push GitHub et le déploiement Vercel après validation.

Aucune commande de diagnostic manuel supplémentaire n’est nécessaire pour reproduire les contrôles : le pipeline rassemble les vérifications et conserve la cause précise de l’échec. L’activation SQL et les essais d’écriture ne sont jamais automatisés sans votre accord.

Références : [Vercel Dev](https://vercel.com/docs/cli/dev), [configuration ESLint](https://eslint.org/docs/latest/use/configure/configuration-files). Les preuves du défaut Node proviennent également du code réellement installé de build-utils 15.3.0 et du test de reproduction.
