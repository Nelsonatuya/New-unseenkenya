alter table public.events drop constraint events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('draft','published','unlisted','cancelled'));

drop policy events_read on public.events;
create policy events_read on public.events for select using (
  status in ('published','unlisted') or host_id = auth.uid() or public.is_admin());

drop policy tiers_read on public.ticket_tiers;
create policy tiers_read on public.ticket_tiers for select using (
  exists (select 1 from public.events e where e.id = event_id and (e.status in ('published','unlisted') or e.host_id = auth.uid() or public.is_admin())));
