import { admin, corsHeaders, json } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const ticketId = typeof body.ticket_id === "string" ? body.ticket_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId)) return json(req, { error: "This ticket link is not valid." }, 400);

    const db = admin();
    const { data: ticket, error } = await db.from("tickets")
      .select("order_id,tier_id,code,holder_name,checked_in_at,events(title,starts_at,venue,town),orders!inner(status)")
      .eq("id", ticketId)
      .eq("orders.status", "paid")
      .maybeSingle();
    if (error) {
      console.error("ticket lookup", error);
      return json(req, { error: "Could not verify this ticket right now." }, 500);
    }
    if (!ticket) return json(req, { error: "This ticket could not be verified." }, 404);

    const { data: item, error: itemError } = await db.from("order_items")
      .select("detail,unit_price_kes")
      .eq("order_id", ticket.order_id)
      .eq("kind", "ticket")
      .eq("tier_id", ticket.tier_id)
      .maybeSingle();
    if (itemError) {
      console.error("ticket item lookup", itemError);
      return json(req, { error: "Could not load ticket details right now." }, 500);
    }
    if (!item) {
      console.error("ticket item lookup returned no ticket item", ticketId);
      return json(req, { error: "Could not load ticket details right now." }, 500);
    }

    return json(req, {
      code: ticket.code,
      holder_name: ticket.holder_name,
      checked_in_at: ticket.checked_in_at,
      event: ticket.events,
      tier_name: item.detail,
      price_kes: item.unit_price_kes,
    });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Could not verify this ticket right now." }, 400);
  }
});
