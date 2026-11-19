import { createClient } from "npm:@supabase/supabase-js@2";

const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

const isLocalDevOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
};

export const corsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin");
  const allowedOrigin = origin && (origin === siteUrl || isLocalDevOrigin(origin))
    ? origin
    : siteUrl || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

/** Service-role client. It bypasses row level security, so it only ever runs inside these functions. */
export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

export const paystackSecret = () => {
  const k = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!k) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return k;
};

/** The signed-in user's id, or null for a guest (the anon key is a valid JWT but not a user). */
export async function userFromRequest(req: Request): Promise<{ id: string; email?: string } | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error || !data.user ? null : { id: data.user.id, email: data.user.email };
}

/** Order, items and tickets for the confirmation page. The reference is the secret that proves it is yours. */
export async function orderView(db: ReturnType<typeof admin>, reference: string) {
  const { data: order } = await db.from("orders").select("*").eq("reference", reference).maybeSingle();
  if (!order) return null;
  const [{ data: items }, { data: tickets }] = await Promise.all([
    db.from("order_items").select("kind,title,detail,unit_price_kes,qty").eq("order_id", order.id),
    db.from("tickets").select("id,code,holder_name,event_id,events(title,starts_at,venue,town)").eq("order_id", order.id),
  ]);
  return {
    reference: order.reference, status: order.status, total_kes: order.total_kes, shipping_kes: order.shipping_kes,
    delivery_method: order.delivery_method, email: order.email, name: order.name, items: items ?? [], tickets: tickets ?? [],
  };
}
