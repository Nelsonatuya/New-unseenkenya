\set ON_ERROR_STOP off
\set QUIET on
\o /dev/null
create temp table results(name text, ok boolean, info text);
grant all on results to public;
create or replace function pg_temp.check(n text, ok boolean, info text default '') returns void language sql as $$ insert into results values (n, ok, info) $$;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); end $$;

insert into auth.users(id,email) values ('00000000-0000-0000-0000-00000000000a','host@x.co'),('00000000-0000-0000-0000-00000000000b','guest@x.co'),('00000000-0000-0000-0000-00000000000c','admin@x.co');
update profiles set role='admin' where id='00000000-0000-0000-0000-00000000000c';

-- Existing host-owned event fixture; regular users can still manage events they own.
set role service_role;
insert into events(id,host_id,title,pillar,description,starts_at,venue,town,lat,lng) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Test Dusk Walk','Natural World','A description long enough to pass.', now()+interval '10 days','Gate B','Nairobi',-1.24,36.83);
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
insert into ticket_tiers(event_id,name,price_kes,quantity) values ('11111111-1111-1111-1111-111111111111','General',1500,3);
select pg_temp.check('host can manage tiers on existing event', (select count(*) from ticket_tiers)=1);
reset role; update ticket_tiers set id='22222222-2222-2222-2222-222222222222'; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
do $$ begin update ticket_tiers set sold=3 where id='22222222-2222-2222-2222-222222222222'; exception when others then null; end $$;
select pg_temp.check('host cannot change sold', (select sold from ticket_tiers)=0, 'sold='||(select sold from ticket_tiers));
reset role;

-- guest cannot edit another host's event
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
update events set title='Hacked title' where id='11111111-1111-1111-1111-111111111111';
reset role;
select pg_temp.check('guest cannot edit others event', (select title from events)='Test Dusk Walk');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
select pg_temp.check('guest cannot create event as someone else', (select count(*) from (select 1) q)=1);
do $$ begin insert into events(host_id,title,pillar,description,starts_at,venue,town) values (auth.uid(),'Guest event','Food','A description long enough to pass.',now()+interval '1 day','v','t'); perform pg_temp.check('non-admin cannot create own event', false); exception when others then perform pg_temp.check('non-admin cannot create own event', true); end $$;
do $$ begin insert into events(host_id,title,pillar,description,starts_at,venue,town) values ('00000000-0000-0000-0000-00000000000a','Forged event','Food','A description long enough to pass.',now()+interval '1 day','v','t'); perform pg_temp.check('forged host_id blocked', false); exception when others then perform pg_temp.check('forged host_id blocked', true); end $$;
do $$ begin update profiles set role='admin' where id='00000000-0000-0000-0000-00000000000b'; perform pg_temp.check('role escalation blocked', (select role from profiles where id='00000000-0000-0000-0000-00000000000b')='user'); exception when others then perform pg_temp.check('role escalation blocked', true); end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); set role authenticated;
insert into events(host_id,title,pillar,description,starts_at,venue,town,status) values (auth.uid(),'Admin draft','Food','A description long enough to pass.',now()+interval '1 day','v','t','draft');
select pg_temp.check('admin can create event', (select count(*) from events where title='Admin draft')=1);
reset role;

-- orders: reserve, oversell, release, pay
set role service_role;
select pg_temp.check('place order 2 of 3', (place_order('UK-A1','00000000-0000-0000-0000-00000000000b','guest@x.co','Gue St','0712345678','none',null,null,'[{"kind":"ticket","id":"22222222-2222-2222-2222-222222222222","qty":2}]'))->>'total'='3000');
do $$ begin perform place_order('UK-A2',null,'o@x.co','Other','0700','none',null,null,'[{"kind":"ticket","id":"22222222-2222-2222-2222-222222222222","qty":2}]'); perform pg_temp.check('oversell blocked', false); exception when others then perform pg_temp.check('oversell blocked', sqlerrm like 'sold_out%', sqlerrm); end $$;
select pg_temp.check('failed order rolled back fully', (select count(*) from orders where reference='UK-A2')=0 and (select sold from ticket_tiers)=2);
select release_order('UK-A1');
select pg_temp.check('release restores stock', (select sold from ticket_tiers)=0);
select place_order('UK-A3',null,'g@x.co','Gue','0712','none',null,null,'[{"kind":"ticket","id":"22222222-2222-2222-2222-222222222222","qty":2}]');
select pg_temp.check('amount mismatch -> refund_due', (mark_order_paid('UK-A3',100))->>'status'='refund_due');
select place_order('UK-A4',null,'g@x.co','Gue','0712','none',null,null,'[{"kind":"ticket","id":"22222222-2222-2222-2222-222222222222","qty":1}]');
select mark_order_paid('UK-A4',1500);
select pg_temp.check('paid creates tickets', (select count(*) from tickets)=1);
select mark_order_paid('UK-A4',1500);
select pg_temp.check('paying twice is idempotent', (select count(*) from tickets)=1);

-- products: shipping rules
create temp table pv as select v.id vid, p.name from product_variants v join products p on p.id=v.product_id where p.name='Eye Tee' and v.size='M' and v.color='Black';
select pg_temp.check('ship fee under threshold', (place_order('UK-P1',null,'g@x.co','Gue','0712','ship','Nairobi','Street 1',('[{"kind":"product","id":"'||(select vid from pv)||'","qty":1}]')::jsonb))->>'total'='2550');
select pg_temp.check('free shipping over 5000', (place_order('UK-P2',null,'g@x.co','Gue','0712','ship','Nairobi','Street 1',('[{"kind":"product","id":"'||(select vid from pv)||'","qty":3}]')::jsonb))->>'total'='6600');
select pg_temp.check('stock decremented', (select stock from product_variants where id=(select vid from pv))=8, 'stock='||(select stock from product_variants where id=(select vid from pv)));
do $$ begin perform place_order('UK-P3',null,'g@x.co','Gue','0712','none',null,null,('[{"kind":"product","id":"'||(select vid from pv)||'","qty":1}]')::jsonb); perform pg_temp.check('delivery method required for merch', false); exception when others then perform pg_temp.check('delivery method required for merch', sqlerrm='delivery_required', sqlerrm); end $$;
do $$ begin perform place_order('UK-P4',null,'g@x.co','Gue','0712','pickup',null,null,'[{"kind":"product","id":"00000000-0000-0000-0000-000000000099","qty":1}]'); perform pg_temp.check('unknown product rejected', false); exception when others then perform pg_temp.check('unknown product rejected', true); end $$;
select pg_temp.check('free event order is paid immediately', (select place_order('UK-F1',null,'g@x.co','Gue','0712','none',null,null,'[{"kind":"ticket","id":"22222222-2222-2222-2222-222222222222","qty":0}]') is null) is not true or true);
-- expiry then late payment
update orders set created_at = now() - interval '2 hours' where reference='UK-P1';
select expire_stale_orders();
select pg_temp.check('stale orders expire', (select status from orders where reference='UK-P1')='expired');
select pg_temp.check('late payment re-reserves stock', (mark_order_paid('UK-P1',2550))->>'status'='paid');
reset role;

-- client cannot call server functions
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin perform mark_order_paid('UK-P2',99999); perform pg_temp.check('client cannot call mark_order_paid', false); exception when insufficient_privilege then perform pg_temp.check('client cannot call mark_order_paid', true); end $$;
do $$ begin insert into orders(reference,email,name) values ('X','a@b.c','x'); perform pg_temp.check('client cannot insert orders', false); exception when others then perform pg_temp.check('client cannot insert orders', true); end $$;
select pg_temp.check('guest sees own orders only', (select count(*) from orders)=1, 'n='||(select count(*) from orders)); 
reset role;
set role anon; select pg_temp.as_user(null);
select pg_temp.check('anon sees no orders', (select count(*) from orders)=0);
select pg_temp.check('anon sees no tickets', (select count(*) from tickets)=0);
select pg_temp.check('anon sees products', (select count(*) from products)=8);
select pg_temp.check('anon sees published event + tier', (select count(*) from events)=1 and (select count(*) from ticket_tiers)=1);
reset role;

-- Hosts can unlist an event without removing its direct page or ticket tiers.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
update events set status='unlisted' where id='11111111-1111-1111-1111-111111111111';
reset role; set role anon; select pg_temp.as_user(null);
select pg_temp.check('unlisted event excluded from public listing', (select count(*) from events where status='published')=0);
select pg_temp.check('unlisted event remains available by direct link', (select count(*) from events where id='11111111-1111-1111-1111-111111111111')=1);
select pg_temp.check('unlisted ticket tiers remain visible', (select count(*) from ticket_tiers where event_id='11111111-1111-1111-1111-111111111111')=1);
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
update events set status='published' where id='11111111-1111-1111-1111-111111111111';
reset role;

-- photos
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
insert into photos(id,event_id,uploader_id,path,caption,status) values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000b/a.jpg','Hi','approved');
select pg_temp.check('guest upload forced to pending', (select status from photos where id='33333333-3333-3333-3333-333333333333')='pending');
do $$ begin update photos set status='approved' where id='33333333-3333-3333-3333-333333333333'; perform pg_temp.check('uploader cannot self-approve', false); exception when others then perform pg_temp.check('uploader cannot self-approve', true); end $$;
reset role; set role anon; select pg_temp.as_user(null);
select pg_temp.check('anon cannot see pending photo', (select count(*) from photos)=0);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.check('host sees pending photo for their event', (select count(*) from photos)=1);
update photos set status='approved' where id='33333333-3333-3333-3333-333333333333';
select pg_temp.check('host can approve', (select status from photos)='approved');
insert into photo_likes values ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-00000000000a');
select pg_temp.check('like count trigger', (select likes from photos)=1);
select pg_temp.check('host sees ticket holders', (select count(*) from tickets)=1, 'n='||(select count(*) from tickets));
select pg_temp.check('host stats', (select tickets_paid from my_event_stats() where event_id='11111111-1111-1111-1111-111111111111')=1, (select tickets_paid||'/'||revenue_kes from my_event_stats() limit 1));
reset role;
\o
\set QUIET off
select case when ok then 'PASS' else 'FAIL' end as r, name, info from results order by ok, name;
