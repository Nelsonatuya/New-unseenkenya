drop policy events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (public.is_admin());
