// Paystack calls this when a charge succeeds. The signature proves the call is genuine.
import { admin, paystackSecret } from "../_shared/common.ts";
import { verifySignature } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("x-paystack-signature"), paystackSecret()))) {
    return new Response("Invalid signature", { status: 401 });
  }
  let evt: { event: string; data: { reference: string; amount: number; currency: string } };
  try { evt = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

  if (evt.event === "charge.success" && evt.data?.currency === "KES") {
    const { error } = await admin().rpc("mark_order_paid", { p_reference: evt.data.reference, p_amount_kes: Math.floor(evt.data.amount / 100) });
    if (error && !String(error.message).includes("order_not_found")) {
      console.error("mark_order_paid", error);
      return new Response("Error", { status: 500 }); // Paystack retries on non-200
    }
  }
  return new Response("ok", { status: 200 });
});
