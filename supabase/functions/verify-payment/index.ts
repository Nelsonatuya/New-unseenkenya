// Called by the confirmation page after Paystack redirects back. It asks Paystack for the truth,
// so the page works even if the webhook is delayed, and it is safe to call repeatedly.
import { admin, corsHeaders, json, orderView, paystackSecret } from "../_shared/common.ts";
import { verifyTransaction } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const { reference } = await req.json();
    if (typeof reference !== "string" || !/^UK-[A-Z0-9]{8}$/.test(reference)) return json(req, { error: "Unknown order." }, 400);
    const db = admin();
    let view = await orderView(db, reference);
    if (!view) return json(req, { error: "Unknown order." }, 404);

    if (view.status === "pending" || view.status === "expired") {
      const tx = await verifyTransaction(paystackSecret(), reference).catch(() => null);
      if (tx?.status === "success" && tx.currency === "KES") {
        const { error } = await db.rpc("mark_order_paid", { p_reference: reference, p_amount_kes: Math.floor(tx.amount / 100) });
        if (error) console.error("mark_order_paid", error);
      } else if (tx && ["failed", "reversed"].includes(tx.status)) {
        await db.rpc("release_order", { p_reference: reference, p_status: "failed" });
      }
      view = (await orderView(db, reference))!;
    }
    return json(req, view);
  } catch (e) {
    console.error(e);
    return json(req, { error: "Could not check the payment. Try again in a moment." }, 500);
  }
});
