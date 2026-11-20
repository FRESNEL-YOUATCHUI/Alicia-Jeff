-- Manual rollback after review only. Retains all photos, drafts, intents and confirmations.
-- Disables the new upload API safely; it does not publish or delete any photo.
begin;
drop function if exists public.wedding_api_upload_draft_ready();
drop function if exists public.wedding_api_upload_complete_draft(uuid,uuid,uuid);
commit;
