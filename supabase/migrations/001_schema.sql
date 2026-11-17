-- Unseen Kenya: core schema
create extension if not exists pgcrypto;

create table public.settings (
  key text primary key,
  value int not null
);
insert into public.settings(key, value) values ('shipping_fee_kes', 350), ('free_shipping_over_kes', 5000);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.profiles(id) on delete set null,
  host_name text,
  title text not null check (char_length(title) between 4 and 120),
  pillar text not null check (pillar in ('People','Culture','Food','Music','Fashion','Art','Talent','Communities','Hidden Gems','Natural World')),
  description text not null check (char_length(description) >= 20),
  starts_at timestamptz not null,
  venue text not null,
  town text not null,
  lat double precision check (lat between -5 and 5.5),
  lng double precision check (lng between 33 and 42.5),
  cover_path text,          -- path in the 'media' bucket, or a site asset like 'site:dusk'
  status text not null default 'published' check (status in ('draft','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_starts_idx on public.events (starts_at);
create index events_host_idx on public.events (host_id);

create function public.events_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and new.host_name is null then
    select full_name into new.host_name from public.profiles where id = new.host_id;
  end if;
  return new;
end $$;
create trigger events_before_write before insert or update on public.events
  for each row execute function public.events_before_write();

create table public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  price_kes int not null check (price_kes >= 0),
  quantity int not null check (quantity > 0),
  sold int not null default 0,
  sort int not null default 0,
  constraint sold_within_quantity check (sold >= 0 and sold <= quantity)
);
create index ticket_tiers_event_idx on public.ticket_tiers (event_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  uploader_id uuid references public.profiles(id) on delete set null,
  path text not null,
  caption text check (char_length(caption) <= 200),
  pillar text,
  status text not null default 'pending' check (status in ('pending','approved','removed')),
  likes int not null default 0,
  created_at timestamptz not null default now()
);
create index photos_status_idx on public.photos (status, created_at desc);
create index photos_event_idx on public.photos (event_id);

create table public.photo_likes (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (photo_id, user_id)
);

create function public.photo_likes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.photos set likes = likes + 1 where id = new.photo_id;
  else update public.photos set likes = greatest(likes - 1, 0) where id = old.photo_id; end if;
  return null;
end $$;
create trigger photo_likes_count after insert or delete on public.photo_likes
  for each row execute function public.photo_likes_count();

-- Uploads by the event host or an admin are approved automatically; everyone else's wait for review.
create function public.photos_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.uploader_id := coalesce(new.uploader_id, auth.uid());
  if public.is_admin() or exists (select 1 from public.events e where e.id = new.event_id and e.host_id = auth.uid()) then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;
  new.likes := 0;
  return new;
end $$;
create trigger photos_before_insert before insert on public.photos
  for each row execute function public.photos_before_insert();

create function public.photos_guard_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if not (public.is_admin() or exists (select 1 from public.events e where e.id = old.event_id and e.host_id = auth.uid())) then
      raise exception 'Only the event host or an admin can change a photo''s status';
    end if;
  end if;
  return new;
end $$;
create trigger photos_guard_update before update on public.photos
  for each row execute function public.photos_guard_update();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text not null default '',
  price_kes int not null check (price_kes >= 0),
  shape text not null default 'tee' check (shape in ('tee','hoodie','cap','tote','mug','print','pin')),
  image_path text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  stock int not null default 0 check (stock >= 0),
  unique (product_id, size, color)
);
create index variants_product_idx on public.product_variants (product_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  name text not null,
  phone text,
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','refund_due')),
  delivery_method text not null default 'none' check (delivery_method in ('none','ship','pickup')),
  delivery_town text,
  delivery_address text,
  subtotal_kes int not null default 0,
  shipping_kes int not null default 0,
  total_kes int not null default 0,
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status, created_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('ticket','product')),
  tier_id uuid references public.ticket_tiers(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  title text not null,
  detail text,
  unit_price_kes int not null,
  qty int not null check (qty between 1 and 20)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  tier_id uuid references public.ticket_tiers(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  code text not null unique default upper(encode(gen_random_bytes(5), 'hex')),
  holder_name text,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);
create index tickets_order_idx on public.tickets (order_id);
create index tickets_event_idx on public.tickets (event_id);
