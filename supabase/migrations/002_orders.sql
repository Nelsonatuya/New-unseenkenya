-- Order, stock and ticket logic. Everything here runs only from the server (service role).

create function public._reserve(p_kind text, p_id uuid, p_qty int)
returns table (title text, detail text, unit_price int, tier uuid, variant uuid)
language plpgsql security definer set search_path = public as $$
declare t record; v record;
begin
  if p_kind = 'ticket' then
    select tt.*, e.title as etitle, e.status as estatus, e.starts_at as estarts into t
      from ticket_tiers tt join events e on e.id = tt.event_id
      where tt.id = p_id for update of tt;
    if not found then raise exception 'unavailable:ticket'; end if;
    if t.estatus <> 'published' or t.estarts < now() then raise exception 'unavailable:%', t.etitle; end if;
    if t.quantity - t.sold < p_qty then raise exception 'sold_out:% (%)', t.etitle, t.name; end if;
    update ticket_tiers set sold = sold + p_qty where id = p_id;
    return query select t.etitle::text, t.name::text, t.price_kes, p_id, null::uuid;
  elsif p_kind = 'product' then
    select pv.*, p.name as pname, p.price_kes as pprice, p.active as pactive into v
      from product_variants pv join products p on p.id = pv.product_id
      where pv.id = p_id for update of pv;
    if not found or not v.pactive then raise exception 'unavailable:product'; end if;
    if v.stock < p_qty then raise exception 'sold_out:% (% / %)', v.pname, v.color, v.size; end if;
    update product_variants set stock = stock - p_qty where id = p_id;
    return query select v.pname::text, (v.color || ' / ' || v.size)::text, v.pprice, null::uuid, p_id;
  else
    raise exception 'invalid_item';
  end if;
end $$;

create function public.release_order(p_reference text, p_status text default 'failed') returns void
language plpgsql security definer set search_path = public as $$
declare o record; i record;
begin
  select * into o from orders where reference = p_reference for update;
  if not found or o.status <> 'pending' then return; end if;
  for i in select * from order_items where order_id = o.id loop
    if i.tier_id is not null then update ticket_tiers set sold = greatest(sold - i.qty, 0) where id = i.tier_id; end if;
    if i.variant_id is not null then update product_variants set stock = stock + i.qty where id = i.variant_id; end if;
  end loop;
  update orders set status = p_status where id = o.id;
end $$;

create function public.expire_stale_orders(p_minutes int default 30) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select reference from orders where status = 'pending' and created_at < now() - make_interval(mins => p_minutes) loop
    perform release_order(r.reference, 'expired'); n := n + 1;
  end loop;
  return n;
end $$;

create function public.mark_order_paid(p_reference text, p_amount_kes int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o record; i record; n int;
begin
  select * into o from orders where reference = p_reference for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'paid' then return jsonb_build_object('status','paid','order_id',o.id,'already',true); end if;
  if o.status = 'refund_due' then return jsonb_build_object('status','refund_due','order_id',o.id); end if;

  if p_amount_kes < o.total_kes then
    update orders set status = 'refund_due', note = format('Amount mismatch: paid %s, expected %s', p_amount_kes, o.total_kes) where id = o.id;
    return jsonb_build_object('status','refund_due','order_id',o.id);
  end if;

  -- Payment arrived after the reservation was released: try to take the stock again.
  if o.status in ('expired','failed') then
    begin
      for i in select * from order_items where order_id = o.id loop
        perform * from _reserve(i.kind, coalesce(i.tier_id, i.variant_id), i.qty);
      end loop;
    exception when others then
      update orders set status = 'refund_due', note = 'Paid after reservation expired and stock ran out: ' || sqlerrm where id = o.id;
      return jsonb_build_object('status','refund_due','order_id',o.id);
    end;
  end if;

  update orders set status = 'paid', paid_at = now() where id = o.id;
  for i in select oi.*, tt.event_id from order_items oi left join ticket_tiers tt on tt.id = oi.tier_id
           where oi.order_id = o.id and oi.kind = 'ticket' loop
    for n in 1..i.qty loop
      insert into tickets (order_id, tier_id, event_id, holder_name) values (o.id, i.tier_id, i.event_id, o.name);
    end loop;
  end loop;
  return jsonb_build_object('status','paid','order_id',o.id);
end $$;

create function public.place_order(
  p_reference text, p_user uuid, p_email text, p_name text, p_phone text,
  p_delivery text, p_town text, p_address text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it record; r record; oid uuid; sub int := 0; merch int := 0; ship int := 0; has_product boolean := false;
        fee int; free_over int; res jsonb;
begin
  perform expire_stale_orders();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'cart_too_large'; end if;
  select value into fee from settings where key = 'shipping_fee_kes';
  select value into free_over from settings where key = 'free_shipping_over_kes';

  insert into orders (reference, user_id, email, name, phone, delivery_method, delivery_town, delivery_address)
  values (p_reference, p_user, lower(p_email), p_name, p_phone, 'none', null, null) returning id into oid;

  -- Lock rows in a stable order so two carts cannot deadlock each other.
  for it in select (x->>'kind') as kind, (x->>'id')::uuid as id, sum((x->>'qty')::int)::int as qty
            from jsonb_array_elements(p_items) x group by 1, 2 order by 1, 2 loop
    if it.qty < 1 or it.qty > 10 then raise exception 'invalid_quantity'; end if;
    select * into r from _reserve(it.kind, it.id, it.qty);
    insert into order_items (order_id, kind, tier_id, variant_id, title, detail, unit_price_kes, qty)
    values (oid, it.kind, r.tier, r.variant, r.title, r.detail, r.unit_price, it.qty);
    sub := sub + r.unit_price * it.qty;
    if it.kind = 'product' then has_product := true; merch := merch + r.unit_price * it.qty; end if;
  end loop;

  if has_product then
    if p_delivery not in ('ship','pickup') then raise exception 'delivery_required'; end if;
    if p_delivery = 'ship' then
      if coalesce(trim(p_town),'') = '' or coalesce(trim(p_address),'') = '' then raise exception 'address_required'; end if;
      ship := case when merch >= free_over then 0 else fee end;
    end if;
  end if;

  update orders set subtotal_kes = sub, shipping_kes = ship, total_kes = sub + ship,
    delivery_method = case when has_product then p_delivery else 'none' end,
    delivery_town = case when p_delivery = 'ship' and has_product then p_town end,
    delivery_address = case when p_delivery = 'ship' and has_product then p_address end
  where id = oid;

  if sub + ship = 0 then
    res := mark_order_paid(p_reference, 0);
    return res || jsonb_build_object('reference', p_reference, 'total', 0);
  end if;
  return jsonb_build_object('status','pending','order_id',oid,'reference',p_reference,'total',sub + ship);
end $$;

revoke all on function public._reserve(text, uuid, int) from public, anon, authenticated;
revoke all on function public.release_order(text, text) from public, anon, authenticated;
revoke all on function public.expire_stale_orders(int) from public, anon, authenticated;
revoke all on function public.mark_order_paid(text, int) from public, anon, authenticated;
revoke all on function public.place_order(text, uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public._reserve(text, uuid, int) to service_role;
grant execute on function public.release_order(text, text) to service_role;
grant execute on function public.expire_stale_orders(int) to service_role;
grant execute on function public.mark_order_paid(text, int) to service_role;
grant execute on function public.place_order(text, uuid, text, text, text, text, text, text, jsonb) to service_role;

-- Per-event numbers for hosts (only their own events; admins see all). Counts paid orders only.
create function public.my_event_stats() returns table (event_id uuid, tickets_paid int, revenue_kes int, reserved int, capacity int)
language sql stable security definer set search_path = public as $$
  select e.id,
    coalesce((select count(*) from tickets t where t.event_id = e.id), 0)::int,
    coalesce((select sum(oi.unit_price_kes * oi.qty) from order_items oi join orders o on o.id = oi.order_id
              where o.status = 'paid' and oi.kind = 'ticket' and oi.tier_id in (select id from ticket_tiers where event_id = e.id)), 0)::int,
    coalesce((select sum(sold) from ticket_tiers where event_id = e.id), 0)::int,
    coalesce((select sum(quantity) from ticket_tiers where event_id = e.id), 0)::int
  from events e
  where e.host_id = auth.uid() or public.is_admin();
$$;
grant execute on function public.my_event_stats() to authenticated;
