# Fichiers de la livraison locale

Répertoire : `C:/Users/Hp EliteBook/Downloads/alicia-jeff-site-local-v3`.

La modification initiale de `.gitignore` est conservée hors de ce commit. Les fichiers privés .env, les données historiques, node_modules, dist, .vercel et les artifacts de test sont exclus. Les trois anciens helpers API sont déplacés pour rester hors des fonctions exposées ; le backend historique reste intact.

| Fichier | Action |
| --- | --- |
| `.env.example` | modifié |
| `MARIAGE-README.md` | modifié |
| `api/gateway.mjs` | créé |
| `docs/AUDIT-INITIAL.md` | créé |
| `docs/RAPPORT-FINAL.md` | créé |
| `docs/SECURITE-SUPABASE.md` | créé |
| `docs/audit/preserved-files.json` | créé |
| `docs/audit/readonly-health.json` | créé |
| `docs/audit/supabase-openapi.json` | créé |
| `docs/audit/vercel-readonly.json` | créé |
| `docs/database/wedding_bucket.csv` | source fournie par le propriétaire |
| `docs/database/wedding_columns.csv` | source fournie par le propriétaire |
| `docs/database/wedding_constraints.csv` | source fournie par le propriétaire |
| `docs/database/wedding_grants.csv` | source fournie par le propriétaire |
| `docs/database/wedding_indexes.csv` | source fournie par le propriétaire |
| `docs/database/wedding_policies.csv` | source fournie par le propriétaire |
| `docs/database/wedding_rls.csv` | source fournie par le propriétaire |
| `package-lock.json` | modifié |
| `package.json` | modifié |
| `scripts/build-schema-fixture.mjs` | créé |
| `scripts/check-frontend-secrets.mjs` | créé |
| `scripts/check-preserved-files.mjs` | créé |
| `scripts/check-staged-secrets.mjs` | créé |
| `scripts/check-supabase-readonly.mjs` | créé |
| `scripts/check-vercel-readonly.mjs` | créé |
| `scripts/configure-storage.mjs` | créé |
| `scripts/dev-legacy.mjs` | créé |
| `scripts/dev-local.mjs` | modifié |
| `scripts/inspect-supabase.mjs` | créé |
| `scripts/vercel-dev.mjs` | créé |
| `scripts/vite-vercel.mjs` | créé |
| `serverless/handler.mjs` | créé |
| `serverless/http.mjs` | créé |
| `serverless/legacy/README.md` | créé |
| `api/_lib/auth.mjs` → `serverless/legacy/auth.mjs` | déplacé, conservé |
| `api/_lib/state.mjs` → `serverless/legacy/state.mjs` | déplacé, conservé |
| `api/_lib/supabase.mjs` → `serverless/legacy/supabase.mjs` | déplacé, conservé |
| `serverless/repository.mjs` | créé |
| `serverless/storage.mjs` | créé |
| `serverless/supabase.mjs` | créé |
| `serverless/validation.mjs` | créé |
| `src/App.tsx` | modifié |
| `src/components/PhotographerPanel.tsx` | modifié |
| `src/components/Souvenirs.tsx` | modifié |
| `src/lib/api.ts` | modifié |
| `src/lib/photographerAuth.ts` | modifié |
| `src/lib/supabase.ts` | modifié |
| `src/lib/testSupabase.ts` | modifié |
| `src/lib/uploads.ts` | créé |
| `supabase/README.md` | créé |
| `supabase/inspect-readonly.sql` | créé |
| `supabase/inspect-storage-readonly.sql` | créé |
| `supabase/migrations/001_serverless.sql` | créé |
| `supabase/migrations/002_api_only_access.sql` | créé |
| `supabase/migrations/003_private_storage_access.sql` | créé |
| `tests/api.test.mjs` | créé |
| `tests/cron.test.mjs` | créé |
| `tests/database.mjs` | créé |
| `tests/grants.test.mjs` | créé |
| `tests/preflight.test.mjs` | créé |
| `tests/schema-fixture.sql` | créé |
| `tests/storage-policy.test.mjs` | créé |
| `tests/storage.test.mjs` | créé |
| `tests/ticket.test.mjs` | créé |
| `vercel.json` | créé |
| `vite.config.ts` | modifié |
| `docs/FICHIERS-MODIFIES.md` | créé, ce manifeste |

## Complément audit Storage

Modifications locales après réception des cinq exports ; aucune modification distante de permissions.

| Fichier | Action |
| --- | --- |
| `docs/AUDIT-INITIAL.md` | modifié |
| `docs/RAPPORT-FINAL.md` | modifié |
| `docs/SECURITE-SUPABASE.md` | modifié |
| `docs/audit/storage-permissions.json` | créé |
| `docs/database/storage_bucket.csv` | export fourni par le propriétaire |
| `docs/database/storage_effective_privileges.csv` | export fourni par le propriétaire |
| `docs/database/storage_grants.csv` | export fourni par le propriétaire |
| `docs/database/storage_policies.csv` | export fourni par le propriétaire |
| `docs/database/storage_rls.csv` | export fourni par le propriétaire |
| `scripts/audit-storage-exports.mjs` | créé |
| `scripts/build-schema-fixture.mjs` | modifié |
| `scripts/lib/csv.mjs` | créé |
| `serverless/storage.mjs` | modifié |
| `supabase/README.md` | modifié |
| `supabase/migrations/003_private_storage_access.sql` | modifié |
| `tests/storage-exports.test.mjs` | créé |
| `tests/storage-fixture.sql` | créé |
| `tests/storage-policy.test.mjs` | modifié |
| `tests/storage.test.mjs` | modifié |
| `docs/FICHIERS-MODIFIES.md` | manifeste complété |

## Diagnostic et fiabilisation Windows — 14 novembre 2026

Liste exhaustive de cette intervention depuis 4d51634. .gitignore préexistant est exclu ; la modification préexistante de vite-vercel.mjs est corrigée conformément à la demande. Voir DIAGNOSTIC-VALIDATION.md pour les explications par fichier.

| Fichier | Action |
| --- | --- |
| `MARIAGE-README.md` | modifié |
| `docs/DIAGNOSTIC-VALIDATION.md` | créé |
| `docs/RAPPORT-FINAL.md` | modifié |
| `docs/audit/browser-validation.json` | créé |
| `docs/audit/local-runtime.json` | créé |
| `docs/audit/preserved-files.json` | modifié |
| `docs/audit/runtime-diagnostic.json` | créé |
| `docs/audit/vercel-readonly.json` | modifié |
| `eslint.config.mjs` | créé |
| `package-lock.json` | modifié |
| `package.json` | modifié |
| `scripts/check-preserved-files.mjs` | modifié |
| `scripts/check-supabase-compatibility.mjs` | créé |
| `scripts/configure-storage.mjs` | modifié |
| `scripts/dev-local.mjs` | modifié |
| `scripts/diagnose-runtime.mjs` | créé |
| `scripts/lib/checks.mjs` | créé |
| `scripts/lib/environment.mjs` | créé |
| `scripts/lib/local-app.mjs` | créé |
| `scripts/lib/processes.mjs` | créé |
| `scripts/prepare-supabase-activation.mjs` | créé |
| `scripts/vercel-dev.mjs` | modifié |
| `scripts/verify-runtime.mjs` | créé |
| `scripts/verify.mjs` | créé |
| `scripts/vite-vercel.mjs` | modifié |
| `server/server.test.mjs` | modifié |
| `serverless/handler.mjs` | modifié |
| `serverless/storage.mjs` | modifié |
| `serverless/supabase.mjs` | modifié |
| `serverless/validation.mjs` | modifié |
| `src/lib/tickets.ts` | modifié |
| `supabase/activation/activate-serverless.sql` | créé |
| `tests/activation.test.mjs` | créé |
| `tests/api.test.mjs` | modifié |
| `tests/runtime.test.mjs` | créé |
| `vite.config.ts` | modifié |
| `docs/FICHIERS-MODIFIES.md` | manifeste complété |

## Audit préalable SQL et rollback — 14 novembre 2026

Fichiers locaux de cette intervention depuis db51f84. Aucune sauvegarde personnelle, clé ou modification préexistante de .gitignore incluse. Les corrections et réserves sont détaillées dans AUDIT-ACTIVATION-SUPABASE.md.

| Fichier | Action |
| --- | --- |
| `MARIAGE-README.md` | modifié |
| `docs/AUDIT-ACTIVATION-SUPABASE.md` | créé |
| `docs/DIAGNOSTIC-VALIDATION.md` | modifié |
| `docs/audit/activation-backup.json` | créé |
| `docs/audit/activation-security.json` | créé |
| `docs/audit/local-runtime.json` | modifié |
| `docs/audit/readonly-health.json` | modifié |
| `package.json` | modifié |
| `scripts/backup-business-readonly.mjs` | créé |
| `scripts/lib/activation-manifest.mjs` | créé |
| `scripts/lib/local-app.mjs` | modifié |
| `scripts/prepare-activation-backup.mjs` | créé |
| `scripts/prepare-activation-rollback.mjs` | créé |
| `scripts/prepare-supabase-activation.mjs` | modifié |
| `scripts/verify-runtime.mjs` | modifié |
| `supabase/activation/activate-serverless.sql` | modifié |
| `supabase/activation/preflight-backup-readonly.sql` | créé |
| `supabase/activation/rollback-serverless.sql` | créé |
| `supabase/migrations/001_serverless.sql` | modifié |
| `supabase/migrations/002_api_only_access.sql` | modifié |
| `tests/activation-audit.test.mjs` | créé |
| `vite.config.ts` | modifié |
| `docs/FICHIERS-MODIFIES.md` | manifeste complété |

## Procédure SQL Editor — 14 novembre 2026

Aucune modification de .env.local ou de la base hébergée. Source d’activation inchangée.

| Fichier | Action |
| --- | --- |
| `MARIAGE-README.md` | lien vers la procédure ajouté |
| `docs/PROCEDURE-SUPABASE-SQL-EDITOR.md` | étapes SQL Editor, arrêts obligatoires et rollback |
| `docs/audit/sql-editor-procedure.json` | empreintes et preuves sans données privées |
| `scripts/prepare-activation-verification.mjs` | générateur local de contrôle SQL en lecture seule |
| `supabase/activation/verify-serverless-readonly.sql` | neuf contrôles et empreintes métier après activation autorisée |
| `tests/sql-editor-verification.test.mjs` | contrôle réel PostgreSQL isolé des résultats et dérives |
| `docs/FICHIERS-MODIFIES.md` | manifeste complété |

## Validation de la capture Supabase réelle — 14 novembre 2026

Captures et rollback privés conservés hors Git. Aucune modification de .env.local ni de la base hébergée.

| Fichier | Action |
| --- | --- |
| `MARIAGE-README.md` | modifié |
| `docs/AUDIT-ACTIVATION-SUPABASE.md` | modifié |
| `docs/VALIDATION-CAPTURE-AVANT-ACTIVATION.md` | créé |
| `docs/audit/activation-security.json` | modifié |
| `docs/audit/preactivation-current-readonly.json` | créé |
| `docs/audit/preactivation-rehearsal.json` | créé |
| `docs/audit/preactivation-review.json` | créé |
| `scripts/check-snapshot-current-readonly.mjs` | créé |
| `scripts/rehearse-activation-snapshot.mjs` | créé |
| `docs/FICHIERS-MODIFIES.md` | manifeste complété |

## Vérification après activation par le propriétaire — 14 novembre 2026

Rapport SQL/API et documentation actualisés ; aucune écriture hébergée supplémentaire par l’agent. Fichiers privés, .gitignore et invitation.png exclus.

| Fichier | Action |
| --- | --- |
| `MARIAGE-README.md` | modifié |
| `docs/AUDIT-ACTIVATION-SUPABASE.md` | modifié |
| `docs/DIAGNOSTIC-VALIDATION.md` | modifié |
| `docs/PROCEDURE-SUPABASE-SQL-EDITOR.md` | modifié |
| `docs/RAPPORT-FINAL.md` | modifié |
| `docs/RAPPORT-POST-ACTIVATION.md` | créé |
| `docs/SECURITE-SUPABASE.md` | modifié |
| `docs/VALIDATION-CAPTURE-AVANT-ACTIVATION.md` | modifié |
| `docs/audit/activation-security.json` | modifié |
| `docs/audit/local-runtime.json` | modifié |
| `docs/audit/postactivation-api-readonly.json` | créé |
| `docs/audit/postactivation-checks.json` | créé |
| `docs/audit/postactivation-review.json` | créé |
| `docs/audit/preactivation-current-readonly.json` | modifié |
| `scripts/verify-postactivation-readonly.mjs` | créé |
| `docs/FICHIERS-MODIFIES.md` | manifeste complété |

## Audit pré-déploiement, ingestion et cron — 14 novembre 2026

Audit, tests isolés et sondes réelles refusées uniquement. Aucun secret, Storage, données hébergées ou déploiement modifié. .gitignore et invitation.png préexistants exclus.

| Fichier | Action |
| --- | --- |
| `MARIAGE-README.md` | modifié |
| `docs/AUDIT-PREDEPLOIEMENT.md` | créé |
| `docs/RAPPORT-POST-ACTIVATION.md` | modifié |
| `docs/audit/local-runtime.json` | modifié |
| `docs/audit/predeploy-build-assets.json` | créé |
| `docs/audit/predeploy-dependencies.json` | créé |
| `docs/audit/predeploy-readonly.json` | créé |
| `docs/audit/predeploy-summary.json` | créé |
| `docs/storage-ingestion-proposal.json` | créé |
| `scripts/audit-predeploy-readonly.mjs` | créé |
| `tests/cron-security.test.mjs` | créé |
| `docs/FICHIERS-MODIFIES.md` | manifeste complété |

## RSVP et contrôle des billets — 18 novembre 2026

La liste exacte des fichiers et les preuves de validation figurent dans [RSVP-QR-FINALISATION.md](RSVP-QR-FINALISATION.md). Les exports privés, classeurs des invités et données de test restent hors Git.

## Correction réelle QR / version de production — 19 novembre 2026

Le [bilan du 19 novembre](CORRECTION-QR-20261119.md) remplace les constats précédents pour cette fonctionnalité et donne la liste des fichiers, la comparaison production/local et les blocages réels. La [procédure Google privée](GOOGLE-SHEETS-LECTURE-PRIVEE.md) indique les deux variables serveur à configurer sans transmettre de clé dans le chat.
