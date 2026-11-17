// Pure helpers shared by the payment functions. No Deno-only APIs, so they can be unit tested with Node.

const enc = new TextEncoder();

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Paystack signs the raw request body with your secret key (HMAC SHA-512, hex) in `x-paystack-signature`. */
export async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const expected = toHex(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
  if (expected.length !== signature.length) return false;
  let diff = 0; // constant-time compare
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export function newReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return "UK-" + [...bytes].map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
}

export const isEmail = (s: unknown): s is string => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;

export type CartLine = { kind: "ticket" | "product"; id: string; qty: number };

export function cleanCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) throw new Error("empty_cart");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const out = raw.map((l) => {
    const qty = Number((l as CartLine)?.qty);
    if (!l || !["ticket", "product"].includes(l.kind) || !uuid.test(String(l.id)) || !Number.isInteger(qty) || qty < 1 || qty > 10) throw new Error("invalid_cart");
    return { kind: l.kind, id: String(l.id).toLowerCase(), qty } as CartLine;
  });
  if (!out.length || out.length > 30) throw new Error("invalid_cart");
  return out;
}

const API = "https://api.paystack.co";

export async function initializeTransaction(secret: string, p: { email: string; amountKes: number; reference: string; callbackUrl: string; metadata?: unknown }) {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: p.email,
      amount: p.amountKes * 100, // Paystack amounts are in the smallest unit (cents)
      currency: "KES",
      reference: p.reference,
      callback_url: p.callbackUrl,
      channels: ["mobile_money", "card"],
      metadata: p.metadata,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.status) throw new Error(json.message || "paystack_init_failed");
  return json.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(secret: string, reference: string) {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.status) throw new Error(json.message || "paystack_verify_failed");
  return json.data as { status: string; amount: number; currency: string; reference: string };
}
