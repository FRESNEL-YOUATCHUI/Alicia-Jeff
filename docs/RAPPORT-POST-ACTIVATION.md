# Rapport après activation Supabase — Alicia & Jeff

> Audit pré-déploiement complémentaire : voir [AUDIT-PREDEPLOIEMENT.md](AUDIT-PREDEPLOIEMENT.md), dont les six tests cron et la proposition d’ingestion non appliquée. Les résultats ci-dessous restent ceux de la validation après activation.

14 novembre 2026, UTC. Dossier : `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`.

**L’activation autorisée est confirmée par l’export SQL fourni et les lectures réelles de l’API. `npm run verify` termine désormais avec le code 0. Le blocage schema_required a disparu.** Les parcours d’écriture et la connexion interactive du photographe restent à valider dans le navigateur ; ils ne sont pas présentés comme testés sur le service hébergé.

## A. Activation et conservation des données

L’exécution de `supabase/activation/activate-serverless.sql` a été effectuée par le propriétaire dans SQL Editor, selon son autorisation finale, sur `alicia-jeff-wedding` (`mcnpagbcehupdbhshcea`). L’agent n’a exécuté aucune migration hébergée ni opération de rollback et n’a effectué aucune mutation métier, Storage, Auth ou secret pendant les vérifications qui suivent. Aucun push GitHub ni déploiement Vercel.

La version locale autorisée conserve son SHA-256 normalisé LF :
`0f3799c3b3339ecff83463df8e8960e1e6141e3a12d0b380cf273983d5a7d1e0`.

L’export privé `postactivation-verification.json` contient une vérification SQL en lecture seule datée du **14 novembre à 18:17:51 UTC**. Ses neuf contrôles sont vrais :

| Contrôle SQL réel | Résultat |
| --- | --- |
| Vingt fonctions présentes | Conforme |
| SECURITY INVOKER et search_path fixé | Conforme |
| EXECUTE limité au serveur/propriétaire | Conforme |
| RLS sur les huit tables | Conforme |
| Accès directs métier des visiteurs retirés | Conforme |
| Lecture de son propre rôle authenticated conservée | Conforme |
| Droits serveur sur les tables | Conforme |
| Trois index explicites valides | Conforme |
| Bucket wedding-photos privé | Conforme |

Les **six empreintes de contenu sont identiques avant/après**, ainsi que les comptes : 3 albums, 1 réglage, 1 staff, 0 photo, 0 RSVP et 0 message. Aucun album ou identifiant n’a disparu. Les compteurs et intentions d’import sont restés à zéro pendant les vérifications API : aucune saisie valide ou mutation n’a été envoyée.

Preuve sans contenu personnel : `docs/audit/postactivation-review.json`. La sauvegarde et le rollback restent dans `.qa-artifacts/backups/`, ignorés par Git et refusés par le serveur local. Le rollback spécifique validé est toujours `rollback-serverless-1794674648187.sql` ; il ne doit pas être lancé automatiquement ni confondu avec le garde-fou suivi dans Git. Son refus des données de coordination non vides demeure applicable.

## B. Changements locaux de cette vérification

Le code applicatif, le design, le SQL autorisé, les variables privées et la configuration Vercel ne sont pas modifiés. Un script supplémentaire `scripts/verify-postactivation-readonly.mjs` réalise les contrôles réels reproductibles, avec le gateway de production et Supabase configuré. Il enregistre seulement statuts, booléens et décomptes ; aucun mot de passe, jeton, URL signée, e-mail ou contenu de visiteur.

Les rapports et le guide de démarrage sont actualisés pour ne plus annoncer les RPC manquantes. La modification préexistante de `public/wedding/invitation.png` est préservée, sans être incluse dans les commits de cette intervention ; son chargement et la construction du site ont été vérifiés avec le fichier présent. La modification préexistante de `.gitignore` est également laissée intacte.

## C. Tests exécutés

| Vérification | Résultat réel | Portée et limite |
| --- | --- | --- |
| `npm run verify` | **Réussi, code 0** | Diagnostic → TypeScript → lint → tests → build → secrets → runtime réel. |
| `npm run typecheck` | Réussi dans verify | Frontend TypeScript. |
| `npm run lint` | Réussi dans verify ; relancé après ajout du script de contrôle | Code source, serveur, scripts et tests. |
| `npm test` | **7 historiques + 63 API/SQL/runtime + 7 assertions de défilement réussis** | Mutations et vrais rôles utilisateur simulés dans les bases de test isolées, sans écritures de production. |
| `npm run build` | Réussi dans verify | Avertissement d’enveloppe connu à la transformation, puis média copié ; l’enveloppe et l’invitation sont accessibles en HTTP. |
| `npm run check:secrets` | Réussi, 7 artifacts texte | Aucune valeur privée configurée ou clé serveur détectée dans le bundle. |
| Runtime local réel | **16 contrôles HTTP réussis** | Frontend/ressources 200, administration anonyme 401, JWT invalide 401, erreurs JSON et protection des fichiers privés. |
| Persistance réelle | `/api/souvenirs` **200** ; ready=true | Plus de 503 schema_required. |
| Contrôles réels complémentaires | **26 contrôles réussis** | Lectures publiques, RPC administratives côté serveur, refus des accès directs, Auth et conservation des comptes. Certains recoupent les contrôles précédents. |
| Export SQL réel | **9 contrôles positifs** | Fonctions, droits, RLS, index et bucket ; six empreintes préservées. |

Détail des contrôles complémentaires :

- `/api/souvenirs` et `/api/messages` répondent 200. Aucun champ de RSVP ou hash privé n’est exposé par les messages.
- La galerie demeure fermée conformément à la date et à la publication configurées. Les accès album/photo indisponibles donnent 404 sans URL privée.
- `/api/admin/state` et `/api/admin/messages` sans connexion donnent 401 ; un JWT invalide est refusé par le véritable service Auth.
- La clé publique ne peut lire directement aucune des six tables ni exécuter la RPC administrative.
- Les RPC administratives de lecture retournent les trois albums, les réglages et la pagination des messages/photos. **Ces appels utilisent la clé backend et ne constituent pas un test HTTP avec un JWT staff.**
- Le membre staff référence un compte Auth existant, confirmé et non banni. Cette vérification est une lecture, sans afficher l’identité ou modifier le compte.
- L’invitation PNG et l’enveloppe sont chargées en HTTP ; leur rendu visuel après téléchargement reste à vérifier manuellement.
- Les formulaires invalides donnent 400 avant les compteurs/mutations. Les comptes des six tables et des deux tables de coordination sont identiques avant/après ces contrôles.

### Non validés sur le service hébergé

Connexion/déconnexion avec le vrai mot de passe, accès HTTP avec un JWT staff valide, refus d’un JWT valide d’un compte sans rôle, création/renommage d’album, import/finalisation Storage, publication/masquage, RSVP/message valide et téléchargement du billet après confirmation réelle. Ces scénarios passent dans les tests isolés ; cela ne remplace pas leur validation réseau et navigateur réelle. Aucun compte de test n’a été créé, aucun identifiant confidentiel demandé et aucune permission élargie.

Preuves : `docs/audit/postactivation-api-readonly.json`, `postactivation-review.json`, `postactivation-checks.json`, `local-runtime.json`. Les fichiers JSON privés fournis par le propriétaire ne sont jamais ajoutés à Git.

## D. Configuration et portée du déploiement futur

| Variable | Destination | État constaté localement |
| --- | --- | --- |
| VITE_SUPABASE_URL | Publique, frontend | Présente et concordante avec le backend |
| VITE_SUPABASE_PUBLISHABLE_KEY | Publique, frontend | Présente ; restrictions d’accès vérifiées |
| SUPABASE_URL | Serveur | Présente |
| SUPABASE_SECRET_KEY | Serveur uniquement | Présente, jamais incluse au frontend |
| CRON_SECRET | Serveur, nettoyage planifié | **Non configurée localement** ; le cron exige au moins 32 caractères |

Les quatre variables Supabase doivent être présentes dans les environnements Vercel que vous utiliserez. Prévoir CRON_SECRET en production pour la tâche quotidienne déjà déclarée dans vercel.json. Son absence n’empêche pas l’ouverture locale du site ou les fonctions principales ; le nettoyage planifié reste volontairement refusé tant que son authentification n’est pas configurée. Aucun secret existant n’a été modifié.

Le bucket est privé, mais ses limites d’ingestion taille/MIME sont toujours nulles. Le backend impose déjà JPEG/PNG/WebP et 20 Mio aux autorisations/finalisations. Le durcissement du bucket à 20 Mio et ces trois MIME reste une décision Storage distincte, non incluse dans votre autorisation SQL et non appliquée ici. Il n’est pas confondu avec RLS ni avec une ouverture du bucket.

## E. Commandes indispensables

Dans `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3` :

```powershell
npm run dev
```

Puis ouvrir **http://127.0.0.1:3000/**. La musique et le parcours d’ouverture restent déclenchés par le clic sur l’enveloppe. Le mode local utilise votre véritable projet Supabase : une confirmation ou un message valide envoyé depuis le navigateur sera enregistré.

Pour vérifier, depuis un autre terminal si le serveur tourne :

```powershell
npm run verify
```

Pour préparer les fichiers de production :

```powershell
npm run build
```

Ces commandes ne poussent ni ne déploient rien et n’exécutent pas de migration.

## F. Validation personnelle avant déploiement

- [ ] Dans le navigateur local, vérifier une confirmation réelle et le billet téléchargé complet ; envoyer un message puis le retrouver dans Souvenirs.
- [ ] Se connecter avec le compte photographe dans l’interface, contrôler les trois albums et tester les opérations autorisées sur une photo/un album dans un cadre approprié, puis se déconnecter. Ne transmettre aucun identifiant dans le chat.
- [ ] Définir les variables Vercel nécessaires, dont le secret du cron ; décider séparément des limites du bucket sans le rendre public.
- [ ] Conserver la sauvegarde et le rollback, puis effectuer vous-même le push GitHub et le déploiement après validation.

**Conclusion de portée :** les contrôles SQL, les lectures API réelles et la vérification automatisée sont réussis. Le projet est prêt pour votre validation manuelle locale ; les écritures réelles et le parcours connecté ne sont pas déclarés validés avant ces essais.
