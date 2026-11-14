# Finalisation locale — Alicia & Jeff

> **État courant après activation :** le propriétaire a exécuté le SQL autorisé ; vérification SQL positive, données préservées et `npm run verify` réussi (code 0). Voir [RAPPORT-POST-ACTIVATION.md](RAPPORT-POST-ACTIVATION.md). Les mentions de blocage/attente ci-dessous décrivent les étapes antérieures ; les changements Storage restent non appliqués.

**Mise à jour du démarrage et des contrôles : consulter `DIAGNOSTIC-VALIDATION.md` (rapport A–F du 14 novembre 2026). Les anciennes commandes/métriques ci-dessous décrivent la livraison précédente. Le démarrage courant est `npm run dev` sur le port 3000.**

Dossier : `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`
Branche : `codex/supabase-vercel-finalisation`
État : code préparé et vérifié localement ; activation SQL et validation complète hébergée encore soumises à autorisation. **Aucun push, aucun déploiement, aucune migration ou modification de permission hébergée.**

## Audit et conservation

Voir `AUDIT-INITIAL.md` et `SECURITE-SUPABASE.md`. Les 33 colonnes, 20 contraintes et 3 politiques initiales ont été analysées avant adaptation. Trois albums existants et bucket privé confirmés en lecture seule. Aucun RSVP/message/photo historique à importer, ni dans Supabase ni dans le backend JSON local au moment du contrôle.

Les empreintes de 15 fichiers confirment la conservation du contenu de la feuille de style, enveloppe, animations, défilement, formulaire RSVP, moteur de billets, médias et ancien backend/tests. Les comparaisons texte normalisent seulement CRLF/LF ; les médias binaires sont identiques. `src/App.tsx` perd uniquement son diagnostic temporaire de connexion, qui se lançait chez chaque visiteur. Le parcours reste une page avec deux volets Souvenirs.

## Changement livré

- Une fonction Vercel `api/gateway.mjs` route les API vers les modules `serverless/`. Les anciens helpers non routés sont conservés dans `serverless/legacy/` ; le serveur historique n’est pas supprimé.
- Auth serveur par Bearer → Supabase `getUser` → rôle `photographer/admin` ; distinction 401/403/503, erreurs sans détails privés.
- PostgreSQL transactionnel pour RSVP/messages, identifiants et SHA-256 de références compatibles avec l’existant, modération préservée lors des répétitions.
- Albums, publication, archivage, photos et messages paginés. Galerie contrôlée côté serveur selon date, verrou global et visibilité.
- Imports signés directs vers Storage : limite 20 MiB, format réel vérifié par lectures partielles, finalisation idempotente, baux/concurrence, arrêt/reprise et nettoyage différé.
- Panneau photographe actif après connexion/session restaurée, renouvellement du jeton et des liens photo ; erreurs et reprise disponibles.
- Secrets serveur exclus du frontend ; absence de configuration Auth ne bloque plus l’invitation entière.
- Proxy Vite uniquement lors d’un lancement standalone explicite. Vercel Dev reçoit ses propres API ; aucune réécriture SPA n’intercepte les scripts/images.
- ExcelJS inutilisé retiré, correctifs npm compatibles appliqués et correctif `tar` 7.5.23 imposé pour retirer l’alerte critique de l’outillage.

## Migrations complémentaires proposées

Ordre : `001_serverless.sql`, `002_api_only_access.sql`, `003_private_storage_access.sql` dans `supabase/migrations/`. Détails dans `supabase/README.md`.

001 ajoute deux tables de coordination avec RLS, index et RPC serveur. Réutilise les contraintes existantes `ref_hash`, `response_id` et `storage_path`. 002 retire les droits directs navigateur métier et conserve la lecture de son propre rôle. 003, optionnelle après analyse des exports Storage, propose des politiques restrictives sur les deux tables Storage, ciblées sur le bucket du mariage.

Aucune table métier ni aucun album n’est recréé. Les contraintes et UUID existants sont conservés. Les scripts sont transactionnels, avec précontrôles et répétition testée localement. **Ne pas les appliquer sans votre accord. Les exports Storage ont été analysés ; la migration 003 est un durcissement facultatif et non la correction d’une fuite établie.**

## Routes API

| Méthode et adresse | Accès / rôle |
| --- | --- |
| GET `/api/health` | Public, liveness uniquement |
| POST `/api/rsvp` | Public, validation et limitation durable ; billet |
| GET / POST `/api/messages` | Public, lecture paginée / dépôt validé |
| GET `/api/souvenirs` | Public, messages et albums visibles |
| GET `/api/photos?album=<uuid>&offset=0` | Public, album autorisé, 60 photos/page et liens signés |
| GET `/api/photos/<uuid>` | Public, même contrôle ; redirection signée, option `?download=1` |
| GET `/api/admin/state` | Bearer et rôle serveur |
| GET `/api/admin/messages?offset=0` | Bearer et rôle, 50 messages/page |
| POST `/api/admin/albums` | Bearer et rôle, création |
| PATCH `/api/admin/albums/<uuid>` | Bearer et rôle, titre/publication/archivage |
| GET `/api/admin/albums/<uuid>/photos?offset=0` | Bearer et rôle, page suivante |
| PATCH `/api/admin/photos/<uuid>` | Bearer et rôle, masquer/restaurer |
| PATCH `/api/admin/messages/<uuid>` | Bearer et rôle, modérer |
| PATCH `/api/admin/settings` | Bearer et rôle, verrou galerie |
| POST `/api/admin/uploads/authorize` | Bearer et rôle, autorisation signée et chemin serveur |
| POST `/api/admin/uploads/<uuid>/finalize` | Bearer et rôle, vérification puis finalisation |
| POST `/api/admin/uploads/<uuid>/cancel` | Bearer et rôle, arrêt / nettoyage différé |
| POST `/api/admin/uploads/cleanup` | Bearer et rôle, nettoyage des objets expirés |
| GET `/api/internal/uploads/cleanup` | `CRON_SECRET` uniquement |

Le binaire photo ne transite plus par `POST /api/admin/albums/<id>/photos` ; ce chemin ne sert désormais que la lecture GET paginée. Les formulaires publics conservent leurs contrats. Aucun endpoint public de liste d’invités n’existe. Les anciens endpoints de cookie login/logout ne sont pas exposés par Vercel.

## Vérifications réellement exécutées

| Vérification | Résultat |
| --- | --- |
| `npm run typecheck` | Réussi |
| `npm run test:server` | 7 tests historiques réussis |
| Nouveaux tests API/SQL/Storage/QR/cron | 38 tests réussis lors du nouveau passage complet, dont les 6 cas de reproduction SQL/RLS Storage |
| `npm run test:experience` | 7 assertions réussies |
| `npm run build` | Réussi ; médias sélectionnés copiés dans dist après le build |
| `npm run check:secrets` | 7 artifacts texte frontend contrôlés, aucune clé privilégiée détectée |
| `node scripts/check-preserved-files.mjs` | 15 contenus conservés |
| Vercel Dev réel | 8 contrôles HTTP lecture seule réussis ; JSON 200/401/404, scripts et médias aux bons MIME |
| Préparation SQL | Rejouabilité des migrations, refus si schéma incompatible et contrôles de permissions testés sur PostgreSQL local |
| Navigateur local | Enveloppe, musique, compteur, navigation, Souvenirs et formulaire photographe ; 390/1440 px sans débordement horizontal |
| `npm audit --omit=dev` | 0 vulnérabilité |
| Audit npm complet | 44 alertes de développement : 1 faible, 23 modérées, 20 élevées, 0 critique |

Preuves de lecture seule : `docs/audit/readonly-health.json`, `vercel-readonly.json` et `supabase-openapi.json`. Les tests SQL utilisent une reproduction des exports avec de faux utilisateurs Auth. Storage réseau et rôles valides sont simulés dans les tests d’intégration ; aucune réussite d’import réel n’est prétendue.

L’API publique de souvenirs renvoie actuellement **503 schema_required** avec la configuration réelle : les RPC n’ont pas encore été installées. `/api/health` n’indique donc pas à lui seul que la persistance est activée. Les essais réels d’écriture et le parcours photographe complet restent à autoriser après activation.

Les téléchargements PDF/PNG dans le navigateur n’ont pas été rejoués dans cette intervention. Leur moteur et le formulaire sont conservés ; le contrat de billet et l’encodage QR ont été testés. Le QR `AJ:<uuid>` reste une référence opaque ; il ne constitue pas un mécanisme de contrôle d’entrée.

## Variables et lancement

| Variable | Destination |
| --- | --- |
| `VITE_SUPABASE_URL` | Frontend, publique |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend, publique |
| `SUPABASE_URL` | Fonction serveur |
| `SUPABASE_SECRET_KEY` | Fonction serveur, secrète |
| `CRON_SECRET` | Fonction serveur, secret distinct >=32 caractères, nettoyage planifié |

`.env.example` contient uniquement des exemples. Configurer les variables dans Development, Preview et Production lors de votre mise en ligne ; la clé secrète ne doit jamais commencer par `VITE_`. Les deux environnements distants peuvent utiliser des projets Supabase séparés pour les essais. `CRON_SECRET` n’a pas été généré ni modifié ici.

```powershell
npm ci
npm run dev:vercel
# http://localhost:3000/
```

Alternative `npm run dev` : Vite 5173 + mêmes handlers API 8787. Historique conservé : `npm run dev:legacy` et `npm start`. Sur Windows, le lanceur Vercel JavaScript fourni avec le CLI évite son problème natif de liens symboliques.

## Checklist avant production

- [x] Examiner les cinq exports Storage : RLS activé, aucune politique, refus par défaut pour les rôles ordinaires malgré les grants SQL.
- [ ] Compléter l’export des grants métier (le fichier reçu compte 100 lignes) et vérifier les attributs des rôles/propriétaires avant une certification exhaustive.
- [ ] Sauvegarder la configuration/le schéma et obtenir l’accord explicite pour les migrations 001/002 ; décider séparément du durcissement facultatif 003.
- [ ] Appliquer les migrations autorisées dans l’ordre, vérifier les trois albums et leurs UUID.
- [ ] Autoriser et configurer les limites du bucket : 20 MiB, JPEG/PNG/WebP ; conserver privé.
- [ ] Tester les écritures sur le vrai projet avec données d’essai explicitement autorisées : RSVP/répétition/billet, message/modération et vrai photographe.
- [ ] Tester upload réel, interruption/reprise, masquage, absence d’accès pour un compte sans rôle, date future, galerie suspendue, download signé.
- [ ] Vérifier/refuser les accès directs Storage et SQL avec anon/authenticated ; examiner séparément les capacités signées.
- [ ] Renseigner `CRON_SECRET`, vérifier son absence du frontend et le nettoyage planifié.
- [ ] Réévaluer les alertes de l’outillage et les limites/quota Storage/Vercel.
- [ ] Configurer les variables par environnement et exécuter les contrôles avant votre déploiement.

## Commandes de mise en ligne — pour le propriétaire uniquement

Non exécutées pendant cette intervention. À utiliser après la checklist et votre décision de mise en ligne :

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run check:secrets
git push -u origin codex/supabase-vercel-finalisation
# Puis créer/intégrer la PR selon votre processus GitHub.
# Autre possibilité : déploiement CLI, après configuration des variables :
npx vercel
npx vercel --prod
```

Aucune commande d’application SQL hébergée n’est automatisée ; aucune clé de connexion PostgreSQL n’est disponible. Les migrations sont consultables et à exécuter uniquement via une session autorisée après accord. Le commit local de livraison est donné dans la réponse finale ; `git rev-parse HEAD` permet de le retrouver.

La modification préexistante de `.gitignore` ajoutant `.vercel` a été conservée et exclue du commit de cette intervention.

## Références techniques

[Réécritures Vercel](https://vercel.com/docs/routing/rewrites), [variables Vercel](https://vercel.com/docs/environment-variables), [protection du cron](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs). Le cron préparé n’existera en production qu’après votre déploiement ; ses appels utilisent le secret dédié. Les détails de sécurité et leurs limites figurent dans `SECURITE-SUPABASE.md`.

Liste détaillée des fichiers : `docs/FICHIERS-MODIFIES.md`.

## Complément après réception des exports Storage

Les cinq fichiers `storage_*.csv` sont désormais analysés : 44 grants explicites, six couples rôle/table et aucune politique. Le refus RLS par défaut est reproduit dans les tests avec des rôles ordinaires, sans interpréter les booléens SQL comme une permission d’accès aux lignes. `service_role` reste réservé au serveur. Aucun privilège ou politique hébergé modifié.

Le backend recontrôle le bucket privé avant la finalisation d’un import. Le précontrôle de 003 refuse un bucket devenu public sans modifier sa visibilité. Voir `docs/SECURITE-SUPABASE.md`, la matrice `docs/audit/storage-permissions.json` et `tests/storage-exports.test.mjs`.
