# Alicia & Jeff — démarrage et validation

Le projet se trouve dans `C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3`. Node.js 22.16.0 est utilisé pour les vérifications.

## Démarrer

Depuis ce dossier :

```powershell
npm run dev
```

Ouvrir **http://127.0.0.1:3000/**. Une seule application Node lance Vite en middleware et les **vrais handlers de `api/gateway.mjs`**. Aucun serveur factice ni stockage JSON historique n’est utilisé pour remplacer Supabase. Un seul port HTTP est nécessaire ; Ctrl+C ferme le serveur et Vite. Si 3000 est déjà occupé, le lancement échoue clairement sans arrêter l’autre programme.

La configuration locale existante `.env.local` est chargée depuis le dossier du projet, sans affichage ni modification de ses secrets. La page reste sur une seule page ; enveloppe, musique, animations, photos et responsive sont conservés.

**Blocage restant :** les tables et le bucket sont accessibles en lecture, mais les RPC de la migration ne sont pas installées. Les fonctionnalités persistantes renvoient donc `503 schema_required`. Le démarrage est corrigé ; l’activation hébergée requiert encore votre accord. Aucun faux succès ni album d’exemple n’est renvoyé pour masquer cet état.

## Vérifier et compiler

```powershell
npm run verify
npm run build
```

`verify` exécute diagnostic, TypeScript, lint, tests, build, contrôle des secrets puis vérification HTTP et Supabase réelle en lecture seule. Il s’arrête à la première erreur avec un code non nul. Il échoue actuellement à la dernière étape uniquement parce que les RPC manquent ; la preuve est dans `docs/audit/local-runtime.json`.

Le rapport structuré A–F, la liste des changements, les résultats et la checklist figurent dans **`docs/DIAGNOSTIC-VALIDATION.md`**.

## Vercel et différences locales

Le mode optionnel `npm run dev:vercel` est corrigé et a passé les contrôles HTTP. Il utilise l’entrée JavaScript livrée avec le CLI installé sous Windows, retire les drapeaux natifs incompatibles et transmet le chemin absolu de Node. Vite doit écouter le port fourni par Vercel, qui peut être 3000 ; forcer 5174 ne respecte pas ce contrat.

Le mode `npm run dev` utilise les API publiques de Node et Vite et n’a pas besoin du cache des builders Vercel. Il partage le gateway, la validation, les contrôles d’authentification et les appels Supabase avec la production. Il ne reproduit pas la sandbox, les limites de durée, l’ordonnanceur ou les en-têtes de l’infrastructure Vercel ; le routage gateway est également testé en HTTP. Les photos sont toujours envoyées directement vers le Storage privé via une autorisation signée.

L’ancien backend reste conservé, ainsi que ses données et sa configuration privées. `npm start` / `npm run dev:legacy` correspondent à ce backend historique indépendant, pas au runtime recommandé.

## Activation proposée, non exécutée

`supabase/activation/activate-serverless.sql` regroupe 001 et 002 dans une seule transaction. Il ajoute les RPC et la coordination, ajuste les droits métier et préserve les tables/albums et leurs identifiants. La proposition Storage 003 est facultative et exclue de ce fichier. Aucun SQL hébergé n’est exécuté automatiquement par les commandes de démarrage ou vérification.

Aucun push GitHub et aucun déploiement Vercel n’ont été effectués.
