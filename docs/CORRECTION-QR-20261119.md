# Correction RSVP / QR — 19 novembre 2026

## Diagnostic constaté sur les versions réellement servies

Le site public https://alicia-jeff.vercel.app répond 200 mais sert encore le bundle /assets/index-BEupU42h.js.
Ce bundle contient presence-count et « Nombre de personnes, vous compris », et conserve le QR texte AJ:...
La route publique /api/tickets/open répond 404. La réponse /api/health ne porte pas la nouvelle version.
Le constat signalé est donc confirmé sur la production : elle ne sert pas les derniers correctifs locaux.

La branche locale est codex/supabase-vercel-finalisation. Un push de cette branche ne suffit pas à prouver que l'alias de production Vercel a été mis à jour.
L'agent n'a effectué ni push ni déploiement. Après votre mise à jour manuelle, /api/health doit indiquer release = rsvp-qr-20261119.

## Corrections effectuées dans le dossier demandé

- Le formulaire réel a été rendu et testé : aucun select de participants, prénom/nom conservés, invitation nominative pour une seule personne.
- Chaque nouveau téléchargement contient désormais un lien HTTPS de vérification, y compris pour une confirmation ancienne. Le téléchargement n'émet plus un QR brut AJ:UUID.
- Dans le PDF, la zone du QR possède aussi une vraie annotation de lien cliquable.
- Le QR utilise par défaut https://alicia-jeff.vercel.app. Un téléchargement local ne produit plus un lien vers le localhost du téléphone.
- Les anciennes confirmations sont retrouvées côté serveur par leur identifiant aléatoire et utilisent les mêmes contrôles d'entrée et de concurrence. Le GET ne crée/consomme aucun billet ; la résolution se fait après la preuve de navigation lors du POST.
- En cas de service indisponible, la page expose un bouton pour réessayer et indique explicitement qu'aucune entrée n'est autorisée.
- Les navigateurs sans Sec-Fetch-Site restent compatibles lorsque l'origine exacte et la preuve/cookie signés sont valides. Les origines étrangères restent refusées.
- start et preview servent désormais le vrai gateway Supabase avec le build. Ils ne lancent plus le serveur historique ou un frontend sans API. dev:legacy reste un mode d'archive distinct.
- L'identifiant connu de la feuille et sa plage sont préconfigurés côté serveur. La plage 'Invités'!A2:A exclut l'en-tête et suit les ajouts ; la limite de 10 000 lignes / 2 Mio reste appliquée.
- verify exige maintenant aussi la disponibilité réelle du schéma QR et de Google Sheets. verify:code ne valide que le code, le build et le runtime existant.

Les anciennes images/PDF déjà téléchargés restent inchangés : ils doivent être téléchargés à nouveau après votre mise à jour du site.

## Résultats

| Contrôle | Résultat |
| --- | --- |
| TypeScript et lint | Réussis |
| Suite complète du code | 7 tests historiques + 92 tests API/SQL/runtime réussis ; 7 assertions de défilement |
| PDF | Générateur réel testé : annotation Link et URI de vérification présentes, coordonnées dans la page |
| Confirmation ancienne | Billet reconnu à partir du RSVP existant ; seconde entrée refusée ; aucune création au GET |
| Formulaire réellement rendu | Zéro sélecteur de personnes |
| Serveur du build | Frontend 200, /api/health versionné, /api/admin/state 401 ; plages audio et chemins privés testés |
| Build et contrôle des secrets | Réussis ; build reconstruit après fixation du domaine public |
| Runtime Supabase normal | 16 contrôles en lecture seule réussis ; aucune confirmation réelle soumise |
| Serveur local effectivement servi | Nouveau bundle index-CZHRA8bz.js, aucun sélecteur, texte une seule personne, route QR HTML 200 |
| Production Vercel actuelle | Ancien bundle et route QR 404 : mise à jour par le propriétaire encore nécessaire |
| Google Sheets depuis le serveur | Non opérationnel : les deux identifiants d'authentification ne sont pas configurés |
| Application de 004 | Non effectuée : connexion Supabase refusée/inutilisable |
| Entrée d'un vrai invité / caméra physique | Non testée ; aucun billet réel consommé |

Le test de formulaire est un rendu du vrai composant React, pas une simple recherche dans son fichier source.
Les tests d'admission utilisent de vraies fonctions SQL dans PostgreSQL isolé. Ils ne sont pas présentés comme une validation hébergée de Google Sheets.

## État du SQL autorisé

Seul le projet mcnpagbcehupdbhshcea a été ciblé.
Le fichier supabase/migrations/004_ticket_entry.sql n'a pas été modifié pendant cette correction et correspond à la version relue du commit 6f94188.

SHA-256 du SQL :
6308483d162d805f019b607335f128446251e8eec33392102a0c25fe99ab53cf

Rollback disponible : supabase/activation/rollback-ticket-entry.sql.
SHA-256 :
a67d83a3096d39f8578077835d7bb007c5e3056bd1b76abc54d631143db15d73

Aucune tentative d'application n'a été faite sans les précontrôles.
Avant reconnexion, la connexion renvoyait :
MCP error -32600: You do not have permission to perform this action
et la liste des projets était vide.

Après la reconnexion demandée, l'identification du projet a renvoyé exactement :
MCP error -32001: Unknown tool({"name":"supabase.get_project"})

Les opérations Supabase ont été arrêtées conformément à votre instruction. L'état des migrations et les contrôles SQL après activation n'ont donc pas pu être obtenus.
La lecture REST constate toujours PGRST205 pour la table d'entrée, mais cela ne remplace pas l'inspection des migrations exigée avant application.
Aucune autre connexion ou clé secrète n'a été utilisée pour contourner ce blocage.

Procédure SQL déjà préparée dans docs/RSVP-QR-FINALISATION.md :
1. Capture privée avec supabase/activation/preflight-backup-readonly.sql.
2. Inspection avant avec supabase/activation/inspect-ticket-entry-readonly.sql.
3. Vérification que 004 n'est pas déjà appliquée et que son contenu correspond au hash autorisé.
4. Exécution du seul 004 après les contrôles.
5. Inspection après ; comparaison des empreintes, fonctions, permissions et RLS.
Ces étapes restent à exécuter via une connexion Supabase fonctionnelle ou votre SQL Editor, sans autre migration.

## Google Sheets privé

La connexion Google Drive de cette conversation n'est pas une authentification utilisable par Vercel.
L'identifiant et la plage sont désormais disponibles par défaut dans le backend.
Il manque encore GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
La procédure complète est dans docs/GOOGLE-SHEETS-LECTURE-PRIVEE.md.

Ne transmettre aucune clé dans le chat. Ajouter seulement ces deux variables à la configuration serveur existante ; ne pas remplacer les autres clés.
Aucune création de clé ni modification des partages Google n'a été effectuée.
La feuille n'a pas été publiée sur le Web.

## Tester

Depuis C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3 :

    npm run dev

Pour le build avec les mêmes API :

    npm run build
    npm start

Pour les contrôles :

    npm run verify

Cette dernière commande doit rester en échec tant que le schéma QR et les identifiants Google manquent.
La réussite de npm run verify:code n'est pas une annonce de mise en service de la vérification des entrées.

Après votre déploiement manuel, consulter https://alicia-jeff.vercel.app/api/health et vérifier release = rsvp-qr-20261119, puis télécharger à nouveau un billet.
La réussite d'un vrai contrôle nécessite aussi l'activation 004 et les identifiants Google : le déploiement seul ne les configure pas.

## Fichiers modifiés pendant cette correction

- .env.example
- MARIAGE-README.md
- docs/RSVP-QR-FINALISATION.md
- index.html
- package.json
- scripts/inspect-ticket-readiness.mjs
- scripts/verify.mjs
- serverless/handler.mjs
- serverless/official-list.mjs
- serverless/repository.mjs
- serverless/ticket-page.mjs
- src/components/RsvpSection.tsx
- src/lib/tickets.ts
- tests/database.mjs
- tests/ticket-entry.test.mjs
- tests/ticket.test.mjs
- docs/CORRECTION-QR-20261119.md
- docs/GOOGLE-SHEETS-LECTURE-PRIVEE.md
- docs/audit/qr-correction-20261119.json
- scripts/serve-built.mjs
- tests/built-runtime.test.mjs
- tests/rsvp-form.test.mjs

## Nouvelle tentative après installation de Supabase

Le plugin est disponible. La documentation Supabase précise que get_project peut être désactivé dans une connexion limitée à un projet ; son absence seule ne prouve donc pas un refus d’accès à la base.

Un contrôle SQL direct, exclusivement en lecture et ciblé sur mcnpagbcehupdbhshcea, a également été tenté. Il a échoué avant exécution avec :

MCP error -32001: Unknown tool({"name":"supabase.execute_sql"})

L’accès à la base et l’état des migrations ne peuvent donc toujours pas être validés. Aucune migration n’a été appliquée, aucun secret ni autre projet modifié. L’autorisation du seul fichier 004 reste conservée ; son application attend des outils Database fonctionnels. Preuve : docs/audit/supabase-reconnect-20261119.json.

Référence : https://supabase.com/docs/guides/ai-tools/mcp#available-tools
