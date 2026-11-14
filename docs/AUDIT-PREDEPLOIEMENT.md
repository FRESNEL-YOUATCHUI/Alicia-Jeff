# Audit pré-déploiement — Alicia & Jeff

14 novembre 2026, UTC. Dossier : `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`.

**Audit du périmètre demandé finalisé : code et tests passent ; protection du cron vérifiée ; limites d’ingestion proposées, non appliquées. Le feu vert de production reste conditionnel à la configuration Vercel et à la recette manuelle des parcours connectés/écritures.** Aucun déploiement, push, migration, changement Storage/Auth, suppression réelle, création ou modification de secret.

## A. Périmètre et verdict

Le gateway Vercel, les routes et en-têtes API, le cron, l’authentification, les règles d’import, les baux SQL et les tests existants ont été relus. La documentation actuelle des fournisseurs a été confrontée au code. Les contrôles réels supplémentaires n’envoient jamais le bon secret au nettoyage : ils ne peuvent donc pas déclencher une suppression.

La configuration `vercel.json` conserve Vite, `dist`, le build existant, le gateway unique et maxDuration=60 secondes. Le chemin `/api/internal/uploads/cleanup` est déclaré à `0 3 * * *`, en UTC. La réécriture API rejoint le même handler protégé. Aucun code applicatif, design ou fichier de configuration privé n’est changé.

Les métadonnées de liaison `.vercel/project.json` sont absentes. Aucun projet Vercel n’a été créé/liée, aucun identifiant confidentiel recherché et aucune variable distante lue : l’état de Production et le plan Vercel restent **non inspectés**.

## B. Proposition d’ingestion — ne pas appliquer sans accord distinct

Le bucket `wedding-photos` est toujours **privé**, mais ses restrictions propres taille/MIME sont nulles. Cela ne signifie pas absence de plafond global : la limite générale du projet s’applique aussi et n’a pas été consultée. Une restriction de bucket doit rester compatible avec ce plafond. [Limites Supabase](https://supabase.com/docs/guides/storage/uploads/file-limits).

| Paramètre | Actuellement | Proposition |
| --- | --- | --- |
| Visibilité | Privé | Conserver privé : public=false |
| Taille maximale par fichier | Limite propre non définie | **20 Mio = 20 971 520 octets** |
| Types MIME | Liste propre non définie | **image/jpeg, image/png, image/webp** |
| Plafond global du projet | Non inspecté | Vérifier qu’il autorise au moins 20 971 520 octets ; aucun ajustement automatique |

Le JSON précis à examiner est `docs/storage-ingestion-proposal.json`. Il ne crée pas de bucket, ne modifie pas les politiques et ne supprime pas d’objet. La proposition est cohérente avec le frontend, le backend et les contraintes SQL déjà en place. Elle ne constitue pas un quota total de volume ou de bande passante. Les propriétés de restriction sont documentées par [Supabase](https://supabase.com/docs/guides/storage/buckets/creating-buckets).

Les contrôles applicatifs restent indispensables : authentification + rôle avant autorisation, nom/chemin généré par le serveur, pas d’écrasement, taille/MIME vérifiés après transfert, contrôle des signatures/dimensions PNG/JPEG/WebP. SVG, HTML, PDF, vidéos et HEIC ne sont pas acceptés par ce parcours photo. Le backend impose déjà le maximum de 20 Mio et refuse 20 Mio + 1 octet ; le bucket apporte une limite d’ingestion en amont quand il sera configuré.

Autres bornes **existantes**, non modifiées : cinq intentions actives par staff, 80 demandes d’autorisation par 15 minutes, intentions valables 30 minutes, dimensions jusqu’à 20 000 pixels par axe et 100 millions de pixels. Il ne s’agit pas d’un décodage antivirus complet. Les jetons d’envoi Supabase restent valables deux heures ; le nettoyage attend au moins 130 minutes depuis la dernière émission, ce qui évite de supprimer pendant la validité normale du jeton. [Durée des autorisations d’envoi](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).

## C. Protection du cron

### Contrôles du handler

- GET uniquement ; HEAD/POST/OPTIONS sont refusés en 405 avec Allow: GET.
- Secret absent ou de moins de 32 caractères : **503 cron_configuration_required**, avant tout accès au dépôt ou au stockage.
- Secret configuré, en-tête absent/incorrect : **401 authentication_required**, avant les dépendances.
- Comparaison du Bearer exact avec timingSafeEqual à longueur égale ; pas de comparaison permissive de préfixe.
- Aucun accès accordé sur User-Agent, x-vercel-cron, x-vercel-cron-schedule, un paramètre de requête ou une simple réécriture vers le gateway.
- Réponses privées sans cache ; les exceptions brutes et les secrets ne sont pas sérialisés.

La présence de CRON_SECRET permet à Vercel de transmettre un Bearer. Sa valeur doit être privée, aléatoire, dédiée, ASCII sans espace ni saut de ligne, et **au moins 32 caractères pour cette application**. Une valeur d’exemple ou de test ne convient pas ; la longueur seule ne prouve pas l’aléa. La copie utilisée dépend du déploiement actif et de sa configuration lors de sa construction. [Protection et configuration Vercel](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs#securing-cron-jobs).

### Résultats réellement obtenus

| Contexte | Test | Résultat |
| --- | --- | --- |
| Handler réel avec la configuration locale actuelle | Cinq GET : sans autorisation, en-têtes Vercel forgés, Bearer étranger, token en query, réécriture gateway | **503**, car le secret local est absent ; aucun accès de nettoyage autorisé |
| Handler réel | POST, HEAD, OPTIONS | **405** |
| Isolation, secret factice configuré | Jeton incorrect, y compris même longueur, mauvais schéma, suffixe ajouté, faux en-têtes, query et gateway | **401**, zéro accès aux dépendances |
| Isolation | Secret vide ou trop court | **503**, zéro accès aux dépendances |
| Isolation | Bon Bearer factice et deux intentions synthétiques | **200** ; suppression simulée uniquement des chemins réclamés, puis marquage uniquement des IDs correspondants |
| Isolation | Échec de suppression simulé et erreur SDK brute | **503/500** ; aucun marquage de succès, détails privés masqués |

Les six tests cron (ancien test conservé et cinq nouveaux) passent dans la suite globale. Les huit sondes réelles du cron ont passé leurs contrôles de méthode, authentification et absence de cache. Les comptes des huit tables sont identiques avant/après et les deux fichiers privés `.env.local`/`.env.wedding.local` sont restés identiques.

**CRON_SECRET est absent localement. La protection est validée, mais un vrai nettoyage autorisé n’a pas été exécuté.** La présence/qualité de la variable en Production n’est pas certifiée. Ce manque de configuration ne bloque pas le site principal ; il bloque volontairement le cron.

### Nettoyage et exploitation

Le SQL ne réclame que des intentions mûres, hors états complete/cleaned, sans photo finale référencée et sans bail actif. FOR UPDATE SKIP LOCKED et les baux de 90 secondes coordonnent les appels ; une erreur avant suppression confirmée ne marque pas les intentions comme nettoyées. Le lot est limité à **50 intentions par invocation**, pas à une collecte illimitée. Les tests SQL isolés existants vérifient conservation des imports complets, expiration et reprise.

Les exécutions peuvent être manquées ou dupliquées, et Vercel ne relance pas automatiquement un appel échoué. Prévoir l’observation des statuts et du nombre nettoyé ; un lot régulièrement plein justifie de réévaluer le débit, sans changer le planning dans cet audit. [Exploitation des crons](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs#cron-job-error-handling).

L’expression quotidienne est compatible avec la fréquence Hobby documentée, mais ce plan peut lancer le job pendant l’heure prévue plutôt qu’à la minute exacte. Le plan utilisé n’a pas été vérifié. [Précision et limites Vercel](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing). La limite de fonction de 60 secondes et les baux doivent rester pris en compte ; aucun cron réel, transfert ou suppression Storage n’est présenté comme testé de bout en bout sur Vercel.

## D. Vérifications pré-déploiement exécutées

| Vérification | Résultat |
| --- | --- |
| `npm run verify` | **Réussi, code 0** |
| TypeScript / lint / build / secrets | Réussis dans la vérification globale |
| Tests | **7 historiques + 68 API/SQL/runtime + 7 assertions de défilement réussis** |
| Sécurité cron isolée | Six tests réussis, inclus dans les 68 |
| Runtime réel standard | 16 contrôles HTTP réussis ; RPC souvenirs disponible |
| Audit réel cron en refus | Huit sondes réussies, aucune exécution autorisée |
| Dépendances de production | `npm audit --omit=dev --json` : **0 vulnérabilité signalée**, aucune correction appliquée |
| Médias de production | Les sept fichiers de public/wedding correspondent au build par SHA-256 |
| Secrets et données pendant les sondes | Fichiers privés et comptes des huit tables inchangés |

L’avertissement Vite concernant l’enveloppe reste lié à la copie des médias après compilation ; la correspondance finale des sept fichiers a été vérifiée. L’audit npm porte sur les dépendances de production, pas sur toutes les dépendances de développement ni sur l’absence absolue de défaut logiciel.

Preuves : `docs/audit/predeploy-readonly.json`, `predeploy-dependencies.json`, `predeploy-build-assets.json`, `predeploy-summary.json`, plus les tests `tests/cron-security.test.mjs`. Le script de collecte `scripts/audit-predeploy-readonly.mjs` est un générateur de rapport en lecture seule ; son code 0 indique que les contrôles exécutés passent, tandis que deployment_readiness reste explicitement conditional.

## E. Conditions à traiter par le propriétaire avant déploiement

1. Vérifier les variables Production : les quatre variables Supabase et CRON_SECRET côté serveur uniquement. Aucun secret ne doit porter de préfixe VITE_. Configurer vous-même un secret dédié convenable avant votre déploiement ; cet audit n’en crée, ne remplace et ne révèle aucun.
2. Décider de la proposition d’ingestion. Une application future nécessite un accord Storage distinct, avec contrôle du plafond global et maintien du bucket privé. La migration optionnelle 003 n’est pas requise pour le refus RLS actuel et n’a pas été exécutée.
3. Terminer la recette réelle avec vos comptes : connexion/déconnexion photographe, RSVP/billet, message, import/finalisation, publication/masquage et compte sans rôle. Les tests isolés et lectures serveur ne remplacent pas ces actions. Le site local utilise la vraie base ; les saisies valides y seront enregistrées.
4. Lors du déploiement que vous réaliserez ensuite, vérifier le statut de la première invocation autorisée et les journaux de l’ordonnanceur, sans exposer le Bearer. Le nettoyage réel n’est pas déclenché par cet audit.

## F. Commandes conservées

Dans le dossier du projet :

```powershell
npm run dev
npm run verify
npm run build
```

Ouvrir http://127.0.0.1:3000/ après le démarrage. Les commandes sont indépendantes ; utiliser un autre terminal pour les contrôles si le serveur tourne. Aucun push GitHub, déploiement, changement de politique, de secret ou de limite Storage n’est effectué par ces commandes.

Le détail des validations SQL et API après l’activation autorisée reste dans `RAPPORT-POST-ACTIVATION.md`. Le fichier d’invitation et `.gitignore`, modifiés avant cette intervention, sont conservés hors de son commit.
