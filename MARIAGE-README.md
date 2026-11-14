# Alicia & Jeff — démarrage et validation

Le projet se trouve dans `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`. Node.js 22.16.0 est utilisé pour les vérifications.

## Démarrer

Depuis ce dossier :

```powershell
npm run dev
```

Ouvrir **http://127.0.0.1:3000/**. Une seule application Node lance Vite en middleware et les **vrais handlers de `api/gateway.mjs`**. Aucun serveur factice ni stockage JSON historique n’est utilisé pour remplacer Supabase. Un seul port HTTP est nécessaire ; Ctrl+C ferme le serveur et Vite. Si 3000 est déjà occupé, le lancement échoue clairement sans arrêter l’autre programme.

La configuration locale existante `.env.local` est chargée depuis le dossier du projet, sans affichage ni modification de ses secrets. La page reste sur une seule page ; enveloppe, musique, animations, photos et responsive sont conservés.

**État après activation :** les vingt fonctions SQL sont présentes, les contrôles de droits/RLS sont positifs et les six empreintes métier sont conservées. Les lectures publiques et administratives côté serveur sont opérationnelles ; `/api/souvenirs` répond 200. Les écritures réelles et la connexion interactive du photographe restent à valider dans le navigateur. Le mode local utilise votre vraie base : les confirmations et messages valides y sont enregistrés.

## Vérifier et compiler

```powershell
npm run verify
npm run build
```

`verify` exécute diagnostic, TypeScript, lint, tests, build, contrôle des secrets puis vérification HTTP et Supabase réelle en lecture seule. Il s’arrête à la première erreur avec un code non nul. Le dernier passage complet après activation réussit avec le code 0 ; la preuve runtime est dans `docs/audit/local-runtime.json`.

Le rapport structuré A–F, la liste des changements, les résultats et la checklist figurent dans **[docs/RAPPORT-POST-ACTIVATION.md](docs/RAPPORT-POST-ACTIVATION.md)**. Le diagnostic historique reste dans `docs/DIAGNOSTIC-VALIDATION.md`.

## Vercel et différences locales

Le mode optionnel `npm run dev:vercel` est corrigé et a passé les contrôles HTTP. Il utilise l’entrée JavaScript livrée avec le CLI installé sous Windows, retire les drapeaux natifs incompatibles et transmet le chemin absolu de Node. Vite doit écouter le port fourni par Vercel, qui peut être 3000 ; forcer 5174 ne respecte pas ce contrat.

Le mode `npm run dev` utilise les API publiques de Node et Vite et n’a pas besoin du cache des builders Vercel. Il partage le gateway, la validation, les contrôles d’authentification et les appels Supabase avec la production. Il ne reproduit pas la sandbox, les limites de durée, l’ordonnanceur ou les en-têtes de l’infrastructure Vercel ; le routage gateway est également testé en HTTP. Les photos sont toujours envoyées directement vers le Storage privé via une autorisation signée.

L’ancien backend reste conservé, ainsi que ses données et sa configuration privées. `npm start` / `npm run dev:legacy` correspondent à ce backend historique indépendant, pas au runtime recommandé.

## Activation effectuée par le propriétaire

`supabase/activation/activate-serverless.sql` regroupe 001 et 002 dans une seule transaction. Il ajoute les RPC et la coordination, ajuste les droits métier et préserve les tables/albums et leurs identifiants. Le propriétaire a exécuté ce fichier dans SQL Editor après autorisation finale et fourni la vérification SQL positive. La proposition Storage 003 est facultative, exclue de ce fichier et n’a pas été exécutée. Aucun SQL hébergé n’est exécuté automatiquement par les commandes de démarrage ou vérification.

Aucun push GitHub et aucun déploiement Vercel n’ont été effectués.

## Audit préalable à l’activation Supabase

L’audit SQL complémentaire et ses réserves sont dans [docs/AUDIT-ACTIVATION-SUPABASE.md](docs/AUDIT-ACTIVATION-SUPABASE.md). La capture SQL transactionnelle réelle et le rollback correspondant sont conservés dans `.qa-artifacts/backups/`, avec une archive REST supplémentaire. Les fichiers privés restent hors Git. Voir le rapport après activation pour l’état courant.

`npm run audit:activation` exécute uniquement les tests PostgreSQL isolés. Le fichier `supabase/activation/rollback-serverless.sql` est un garde-fou : le vrai rollback doit être généré à partir de l’instantané complet avec `npm run prepare:rollback -- <snapshot.json>`, puis revu avant toute exécution autorisée.

La procédure pas à pas pour la session Supabase déjà connectée est dans [docs/PROCEDURE-SUPABASE-SQL-EDITOR.md](docs/PROCEDURE-SUPABASE-SQL-EDITOR.md). Elle distingue la capture préalable en lecture seule, l’arrêt pour analyse/accord final, l’activation et son contrôle en lecture seule. Aucun changement de `.env.local` n’est requis.

La capture SQL réelle est maintenant reçue et validée ; le rollback privé et la répétition adaptée sont documentés dans [docs/VALIDATION-CAPTURE-AVANT-ACTIVATION.md](docs/VALIDATION-CAPTURE-AVANT-ACTIVATION.md). L’activation autorisée a depuis été effectuée ; le bilan courant est `docs/RAPPORT-POST-ACTIVATION.md`.

## Dernières validations avant votre déploiement

Tester dans le navigateur une confirmation/billet, un message et la connexion/opérations photographe avec vos propres comptes, sans partager d’identifiants. Les validations d’écriture automatisées utilisent uniquement les bases isolées.

Prévoir les quatre variables Supabase dans les environnements Vercel nécessaires, plus `CRON_SECRET` (au moins 32 caractères) pour le nettoyage quotidien. Ce secret n’est pas configuré localement. Le bucket reste privé avec limites MIME/taille non définies ; leur éventuel durcissement nécessite une autorisation Storage distincte. Aucun secret n’a été modifié ici.
