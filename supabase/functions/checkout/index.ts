// Creates an order (reserving stock at server-side prices) and starts a Paystack payment.
import { admin, corsHeaders, json, paystackSecret, userFromRequest } from "../_shared/common.ts";
import { cleanCart, initializeTransaction, isEmail, newReference } from "../_shared/paystack.ts";

const FRIENDLY: Record<string, string> = {
  empty_cart: "Your cart is empty.", invalid_cart: "Something in your cart is no longer valid. Refresh and try again.",
  invalid_quantity: "Quantities must be between 1 and 10.", delivery_required: "Choose delivery or event pickup for your merchandise.",
  address_required: "Add a delivery town and address.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const items = cleanCart(body.items);
    const name = String(body.customer?.name ?? "").trim();
    const email = String(body.customer?.email ?? "").trim();
    const phone = String(body.customer?.phone ?? "").trim();
    if (name.length < 2 || name.length > 120) return json({ error: "Enter your full name." }, 400);
    if (!isEmail(email)) return json({ error: "Enter a valid email address." }, 400);
    if (phone.length < 7 || phone.length > 20) return json({ error: "Enter a phone number." }, 400);

    const user = await userFromRequest(req);
    const db = admin();
    const reference = newReference();
    const d = body.delivery ?? {};

    const { data: placed, error } = await db.rpc("place_order", {
      p_reference: reference, p_user: user?.id ?? null, p_email: email, p_name: name, p_phone: phone,
      p_delivery: d.method ?? "none", p_town: d.town ?? null, p_address: d.address ?? null, p_items: items,
    });
    if (error) {
      const msg = error.message ?? "";
      if (msg.startsWith("sold_out:")) return json({ error: `Sorry, ${msg.slice(9)} just sold out. Reduce the quantity or pick another option.`, code: "sold_out" }, 409);
      if (msg.startsWith("unavailable")) return json({ error: "One of the items in your cart is no longer available.", code: "unavailable" }, 409);
      if (FRIENDLY[msg]) return json({ error: FRIENDLY[msg] }, 400);
      console.error("place_order", error);
      return json({ error: "We could not create your order. Please try again." }, 500);
    }

    if (placed.status === "paid") return json({ reference, status: "paid" }); // free RSVP, nothing to pay

    const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
    try {
      const init = await initializeTransaction(paystackSecret(), {
        email, amountKes: placed.total, reference, callbackUrl: siteUrl + "/", metadata: { order_id: placed.order_id, custom_fields: [{ display_name: "Name", variable_name: "name", value: name }] },
      });
      return json({ reference, status: "pending", authorization_url: init.authorization_url });
    } catch (e) {
      await db.rpc("release_order", { p_reference: reference, p_status: "failed" });
      console.error("paystack init", e);
      return json({ error: "The payment provider is unavailable right now. You have not been charged." }, 502);
    }
  } catch (e) {
    const m = (e as Error).message;
    if (FRIENDLY[m]) return json({ error: FRIENDLY[m] }, 400);
    console.error(e);
    return json({ error: "Bad request." }, 400);
  }
});
