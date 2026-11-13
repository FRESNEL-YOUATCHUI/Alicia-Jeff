# Alicia & Jeff — version Supabase / Vercel préparée localement

Le rendu, l’enveloppe, les photos, les animations, la musique, le responsive et le parcours sur une seule page sont conservés. Aucun push GitHub ni déploiement n’a été effectué.

**Activation en attente :** les migrations complémentaires sont préparées, mais ne sont pas appliquées au projet Supabase. Les API concernées répondent `503 schema_required` jusqu’à cette activation. Consulter `docs/RAPPORT-FINAL.md` et `supabase/README.md`.

## Configuration locale

Node.js 22. Renseigner localement les variables de `.env.example` dans `.env.local`, ignoré par Git. Deux variables publiques `VITE_SUPABASE_*` et deux variables serveur `SUPABASE_*`. Le cron nécessite également `CRON_SECRET` ; ne pas préfixer les secrets par `VITE_`.

```powershell
npm ci
npm run dev:vercel
```

Ouvrir `http://localhost:3000/`. Sur Windows, le script utilise l’entrée JavaScript officielle fournie avec le CLI Vercel pour éviter les droits de liens symboliques de son installateur natif. Il charge `.env.local` sans afficher ses valeurs. Après modification des variables, redémarrer le processus.

Alternative sans l’émulation Vercel :

```powershell
npm run dev
```

Elle sert Vite sur `http://127.0.0.1:5173/` et les mêmes handlers serverless sur le port 8787. Le proxy n’est activé que par ce lancement ; il ne détourne pas les fonctions de `vercel dev`.

## Parcours conservé

- Ouverture de l’enveloppe A & J, fleurs/cœurs/roses, musique en boucle et lecture automatique.
- Actions tactiles, molette, clavier et navigation suspendent le défilement ; reprise après 7 secondes sans action. Les formulaires et la visionneuse suspendent aussi la lecture.
- Confirmation uniquement dans « Et si vous faisiez partie de ce beau chapitre ? » ; billet PNG/PDF complet après validation.
- QR `AJ:<uuid RSVP>` et numéro `AJ-XXXXXXXX` conservés. Il s’agit d’une référence, pas d’un contrôle d’entrée.
- Souvenirs Messages et Images en fin de page. Messages affichés comme texte ; albums publics seulement après date et autorisation.
- Espace photographe intégré : connexion e-mail/mot de passe Supabase, albums, imports multiples directs signés, modération et publication.
- Photos privées signées pour 10 minutes, renouvelées pendant la consultation. Les anciennes URLs restent valables jusqu’à expiration après une dépublication.

## Vérifier

```powershell
npm run typecheck
npm test
npm run build
npm run check:secrets
npm audit --omit=dev
```

Les tests PostgreSQL sont exécutés dans PGlite local, avec le schéma reproduit depuis les CSV et des identités simulées. Ils ne modifient pas le projet hébergé. Les tests historiques du serveur Node sont conservés.

## Ancien backend conservé

`npm run dev:legacy` et `npm start` continuent d’exécuter le backend Node historique. Celui-ci reste indépendant des API Supabase et conserve `.wedding-data` et `.env.wedding.local` intacts. Il n’est pas destiné à Vercel. La connexion photographe de l’interface actuelle utilise Supabase et n’est pas compatible avec son ancien cookie ; utiliser la nouvelle API pour administrer les photos.

## Mise en ligne par le propriétaire

Ne lancer aucune commande de déploiement avant activation SQL autorisée et validation des parcours réels. La procédure, les variables par environnement et la checklist figurent dans `docs/RAPPORT-FINAL.md`. Aucun secret réel n’est inclus dans les fichiers versionnés.
