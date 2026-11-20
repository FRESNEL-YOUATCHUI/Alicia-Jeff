# Fichiers de la campagne intégrée du 20 novembre 2026

Dossier : C:/Users/Hp EliteBook/Downloads/alicia-jeff-site-local-v3. Base : main à 8f4e9b7.
Aucun fichier indexé, commit, push ou déploiement réalisé. Inventaire de cette campagne uniquement.

| Fichier | Action | But |
| --- | --- | --- |
| MARIAGE-README.md | modifié | Démarrage, vérification complète et limites de validation |
| docs/FICHIERS-MODIFIES.md | modifié | Inventaire exact de cette campagne |
| docs/GOOGLE-SHEETS-LECTURE-PRIVEE.md | modifié | Délégation temporaire propriétaire et contrôle Google sans billet |
| docs/RAPPORT-FINAL.md | modifié | Bilan intégré, preuves, limites et validation groupée |
| docs/audit/finalisation-20261120.json | ajouté | Résultats structurés sans données privées |
| index.html | modifié | Identifiant de version du build |
| package-lock.json | modifié | Verrouillage de playwright-core, dépendance de développement |
| package.json | modifié | Commandes de livraison et dépendance navigateur de test |
| scripts/prepare-owner-probe-grant.mjs | ajouté | Autorisation courte privée, sans réseau ni affichage du jeton |
| scripts/serve-built.mjs | modifié | Identifiant de version commun au serveur local |
| scripts/test-browser.mjs | ajouté | Tests navigateur réels, API/SQL isolés, huit largeurs |
| scripts/verify-delivery.mjs | ajouté | Vérifications de code puis navigateur avec code de sortie |
| serverless/handler.mjs | modifié | Diagnostic Google délégué et disponibilité des brouillons |
| serverless/owner-probe-grant.mjs | ajouté | HMAC, compte exact, scope unique et expiration |
| serverless/release.mjs | ajouté | Version de livraison partagée |
| serverless/repository.mjs | modifié | Finalisation privée des imports, refus si 005 manque |
| src/PhotographerPage.tsx | ajouté | Page dédiée /photographe |
| src/Root.tsx | ajouté | Chargement différé des deux espaces |
| src/components/EnvelopeOpening.tsx | modifié | Focus clavier de l’enveloppe |
| src/components/OwnerDiagnostics.tsx | ajouté | Diagnostic protégé avec fichier de délégation en mémoire |
| src/components/PhotographerPanel.tsx | modifié | Aperçus, imports en brouillon, publication explicite et gestion |
| src/components/RsvpSection.tsx | modifié | Ponctuation insécable du titre, formulaire conservé |
| src/components/Souvenirs.tsx | modifié | Page photographe liée, galerie actualisée et navigation clavier |
| src/index.css | modifié | Photographe responsive, contraste, focus et compte à rebours 320 px |
| src/lib/api.ts | modifié | Client Supabase chargé seulement pour les appels authentifiés |
| src/lib/uploads.ts | modifié | Suivi de l’identifiant final des photos sans changer le protocole signé |
| src/main.tsx | modifié | Point d’entrée conservant StrictMode |
| supabase/activation/inspect-draft-uploads-readonly.sql | ajouté | Pré/post contrôle SQL en lecture seule |
| supabase/activation/rollback-draft-uploads.sql | ajouté | Rollback manuel limité aux deux nouvelles fonctions |
| supabase/migrations/005_draft_uploads.sql | ajouté | Deux fonctions complémentaires privées, non exécutées à distance |
| tests/api.test.mjs | modifié | Publication explicite exigée dans le test existant |
| tests/built-runtime.test.mjs | modifié | Version attendue du runtime construit |
| tests/database.mjs | modifié | 005 appliquée seulement dans les bases isolées |
| tests/draft-publication.test.mjs | ajouté | ACL, conservation, idempotence et brouillon privé |
| tests/full-browser-fixture.mjs | ajouté | Vrai handler et SQL isolés, transports externes simulés |
| tests/owner-probe-grant.test.mjs | ajouté | Compte, signature, expiration, authentification et audit |
| vercel.json | modifié | Réécritures /photographe uniquement ; Vite, API, cron et Node conservés |
| scripts/lib/migration005.mjs | ajouté | Construction et validation de sauvegarde 005, garde anti-rejeu |
| scripts/prepare-migration005.mjs | ajouté | Preparation hors ligne, integrite, fenetre trente minutes et comparaisons |
| supabase/activation/migration005-backup-readonly.sql | ajouté | Capture transactionnelle privee en lecture seule des neuf tables |
| tests/migration005-delivery.test.mjs | ajouté | Tests de compatibilite 004, backup, refus de rejeu et CLI sans reseau |

## Fichiers préexistants non suivis, conservés séparément

Ces neuf éléments étaient déjà présents avant la campagne ; ne pas les inclure automatiquement dans ce commit. Leur contenu et leur opportunité de publication nécessitent une revue distincte.

- docs/audit/MCP-CHARGEMENT-20261119.md
- docs/audit/MIGRATION-004-AUDIT-DISTANT-20261119.md
- docs/audit/MIGRATION-004-EXECUTION-20261119.md
- docs/audit/google-sheets-oidc-validation-20261119.json
- docs/audit/mcp-connecteur-diagnostic-20261119.md
- docs/audit/migration004-execution-20261119.json
- docs/audit/migration004-remote-20261119.json
- supabase/activation/004_ticket_entry.mcp-runner.prepared.sql
- supabase/activation/mcp-migration004.config.example.toml

## Exclus de toute livraison Git

.env.local, .qa-artifacts (sauvegardes, jetons temporaires, PDF et captures), .vercel, node_modules, dist et données historiques restent ignorés. .gitignore est inchangé.
Les migrations 001–004, les modules Google OIDC/liste officielle et les secrets existants sont inchangés.
005 est une nouvelle proposition locale, soumise à accord avant application hébergée.
