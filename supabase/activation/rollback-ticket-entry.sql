-- Owner approval required. Preserve all RSVP rows, messages and all admission evidence.
-- This is a DISABLING rollback: it keeps the private table and tokens for investigation/re-enable.
begin;
revoke execute on function public.wedding_api_confirm(jsonb,text) from service_role;
revoke execute on function public.wedding_api_ticket_restore(text,text) from service_role;
revoke execute on function public.wedding_api_ticket_lookup(text) from service_role;
revoke execute on function public.wedding_api_ticket_enter(text,timestamptz,text) from service_role;
revoke all on public.wedding_ticket_entries from service_role;
-- Then restore the pre-change application release. The original wedding_api_rsvp is unchanged.
-- Do not run the old architecture rollback against a project with active ticket records.
commit;
