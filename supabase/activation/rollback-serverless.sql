-- Deliberately fails closed: no prior permissions can be inferred from the incomplete CSV exports.
-- First capture the complete JSON from preflight-backup-readonly.sql privately.
-- Then generate the executable, snapshot-specific rollback:
-- node scripts/prepare-activation-rollback.mjs <private snapshot.json>
-- Output: .qa-artifacts/backups/rollback-serverless-<timestamp>.sql (ignored by Git).
-- Do not execute this placeholder as an attempted rollback.
do $guard$ begin raise exception 'Snapshot-specific rollback required. Run the local generator with the complete preactivation backup.';end $guard$;
