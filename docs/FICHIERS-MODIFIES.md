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
