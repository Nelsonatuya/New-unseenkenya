-- Row level security. The browser only ever uses the anon or signed-in key, so these rules are the real access control.
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_tiers enable row level security;
alter table public.photos enable row level security;
alter table public.photo_likes enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;

create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- profiles
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- events
create policy events_read on public.events for select using (status = 'published' or host_id = auth.uid() or public.is_admin());
create policy events_insert on public.events for insert to authenticated with check (host_id = auth.uid() or public.is_admin());
create policy events_update on public.events for update to authenticated using (host_id = auth.uid() or public.is_admin()) with check (host_id = auth.uid() or public.is_admin());
create policy events_delete on public.events for delete to authenticated using (host_id = auth.uid() or public.is_admin());

-- ticket tiers: hosts manage definitions, nobody but the server touches `sold`
create policy tiers_read on public.ticket_tiers for select using (
  exists (select 1 from public.events e where e.id = event_id and (e.status = 'published' or e.host_id = auth.uid() or public.is_admin())));
create policy tiers_write on public.ticket_tiers for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and (e.host_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.events e where e.id = event_id and (e.host_id = auth.uid() or public.is_admin())));
revoke insert, update on public.ticket_tiers from anon, authenticated;
grant insert (event_id, name, price_kes, quantity, sort), update (name, price_kes, quantity, sort) on public.ticket_tiers to authenticated;

-- photos
create policy photos_read on public.photos for select using (
  status = 'approved' or uploader_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()));
create policy photos_insert on public.photos for insert to authenticated with check (uploader_id = auth.uid());
create policy photos_update on public.photos for update to authenticated
  using (uploader_id = auth.uid() or public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()));
create policy photos_delete on public.photos for delete to authenticated
  using (uploader_id = auth.uid() or public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()));
revoke update on public.photos from anon, authenticated;
grant update (status, caption) on public.photos to authenticated;

create policy likes_read on public.photo_likes for select using (true);
create policy likes_insert on public.photo_likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_delete on public.photo_likes for delete to authenticated using (user_id = auth.uid());

-- shop
create policy products_read on public.products for select using (active or public.is_admin());
create policy products_admin on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy variants_read on public.product_variants for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.active or public.is_admin())));
create policy variants_admin on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders and tickets are written only by the server
create policy orders_own on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy order_items_own on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy tickets_read on public.tickets for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()));
create policy tickets_checkin on public.tickets for update to authenticated using (
  public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()));
revoke insert, update, delete on public.orders, public.order_items, public.tickets from anon, authenticated;
grant update (checked_in_at) on public.tickets to authenticated;
