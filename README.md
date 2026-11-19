# Unseen Kenya

Events, photo galleries and a merch shop for Unseen Kenya.
Front end: Vite + vanilla JS. Back end: Supabase (Postgres, Auth, Storage, Edge Functions). Payments: Paystack (M-Pesa and card). Maps: OpenStreetMap with Leaflet.

## What is real in this build

| Feature | How it works |
|---|---|
| Accounts | Supabase Auth: email and password, Google sign-in, password reset. Guests can still buy tickets and merch. |
| Database | Postgres tables for events, ticket tiers, photos, likes, products, variants, orders, tickets. Access is enforced by row level security (`supabase/migrations/003_security.sql`), not by the browser. |
| Photos | Resized in the browser, stored in a Supabase Storage bucket. Uploads by the event host or an admin go live at once; everyone else's wait for approval in the host dashboard. |
| Event listings | Only admins can create events. Hosts can remove an event from public listings without deleting it; its direct page, tickets and host dashboard history remain available. |
| Payments | Paystack hosted checkout (M-Pesa STK push and card). Prices and stock are decided on the server. A signed webhook and a verify call confirm payment, then tickets are created. |
| Overselling | Stock and tickets are reserved in one database transaction when checkout starts and released if payment fails or is not completed in 30 minutes. |
| Map search | Place search (Nominatim) and a draggable pin when creating events. Event pages show the pin with directions. The events page has a map view that sorts by distance from a town you search. |
| Admin | `/#admin` lets admins edit products, stock, photos, delivery fees and see orders. |

## Setup (about 45 minutes)

You need accounts with Supabase, Paystack (Kenya, KES) and a host for static sites (Vercel or Netlify). Node 20+ and the [Supabase CLI](https://supabase.com/docs/guides/cli) on your computer.

### 1. Database
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies supabase/migrations/001 to 007
```
No CLI? Paste each file from `supabase/migrations/` into the Supabase SQL editor, in numeric order.
`005_seed_products.sql` adds a starter shop catalogue you can edit later.

### 2. Sign-in
In Supabase, Authentication:
- URL Configuration: set **Site URL** to your live address (for example `https://unseenkenya.co.ke`) and add it, plus `http://localhost:5173`, to **Redirect URLs**.
- Providers: email is on by default. For Google, create an OAuth client in Google Cloud Console and add `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` as an authorised redirect URI, then paste the client ID and secret into Supabase.
- Email: Supabase's built-in sender is limited to a few emails an hour. Add your own SMTP (Authentication > SMTP) before launch.

### 3. Payments
1. In Paystack, switch on M-Pesa and cards for KES. Use **test keys** first.
2. Set the webhook URL (Settings > API Keys & Webhooks) to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`.
3. Deploy the functions and store the secrets:
```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx SITE_URL=https://unseenkenya.vercel.app
supabase functions deploy checkout
supabase functions deploy verify-payment
supabase functions deploy ticket-details
supabase functions deploy paystack-webhook --no-verify-jwt
```
Set `SITE_URL` to the exact production site origin (not `localhost`); it is used for CORS and as the Paystack return URL. The checkout and payment-verification functions also accept local `http://localhost`/`http://127.0.0.1` development origins.
The secret key never goes in the front end.

### 4. Front end
```bash
cp .env.example .env      # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Project Settings > API)
npm install
npm run dev               # http://localhost:5173
npm run build             # outputs dist/ for Vercel or Netlify
```
On Vercel or Netlify, add the same two variables in the project settings. Routing uses the `#` part of the address, so no rewrite rules are needed.

### 5. Make yourself an admin
Create your account on the site, then run in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

### 6. Test before going live
Use Paystack test mode: buy a ticket and a product, check that the order shows as paid in `/#admin`, the ticket QR appears on the confirmation page and under Account, and stock drops. Upload a photo from a second account and approve it from the host dashboard. Then swap in the live Paystack key (`supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx`) and repeat once with a small real payment.

## Tests
```bash
npm run test:payments     # signature check, cart validation (Node 22+)
PGHOST=... PGUSER=... npm run test:db   # schema and security rules on a throwaway local Postgres
```
The database tests cover overselling, double payment, late payment, wrong amounts, who can read orders and tickets, photo approval and role escalation.

## Known limits and next steps
- **Apple Pay and Google Pay** are not enabled; Paystack's Kenya checkout offers M-Pesa and card.
- **Refunds** are done in the Paystack dashboard. Cancelling an event marks it cancelled but does not refund automatically. Orders where payment arrived after stock ran out are flagged `refund due` in Admin.
- **Emails:** Paystack emails a receipt. Tickets are shown on the confirmation page and under Account; there is no ticket email yet. Adding one means calling an email service (for example Resend) from `_shared` once an order is paid.
- **Place search** uses the free Nominatim service, which allows light use only. Before heavy traffic, point `VITE_GEOCODER_URL` at a Nominatim-compatible provider.
- **Photo upload** shows a status per photo rather than a progress bar.
- **Ticket scanning:** each ticket QR opens a verification page with the holder, event, ticket tier and price. Hosts can check guests in under Host dashboard > Guests; a camera scanner is not built.
- **Rate limiting:** add Supabase or Cloudflare rate limits on the `checkout` function before launch to deter abuse.
- The poster crops in `public/img` are low resolution. Replace them with real photography (keep the file names, or point events at uploaded covers).
