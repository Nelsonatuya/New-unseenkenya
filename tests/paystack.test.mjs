import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySignature, cleanCart, isEmail, newReference } from "../supabase/functions/_shared/paystack.ts";

test("accepts a genuine Paystack signature", async () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "UK-ABCDEFGH", amount: 150000, currency: "KES" } });
  const sig = createHmac("sha512", "sk_test_secret").update(body).digest("hex");
  assert.equal(await verifySignature(body, sig, "sk_test_secret"), true);
});
test("rejects a forged, tampered or missing signature", async () => {
  const body = '{"event":"charge.success"}';
  const sig = createHmac("sha512", "sk_test_secret").update(body).digest("hex");
  assert.equal(await verifySignature(body, sig, "other_secret"), false);
  assert.equal(await verifySignature(body + " ", sig, "sk_test_secret"), false);
  assert.equal(await verifySignature(body, null, "sk_test_secret"), false);
  assert.equal(await verifySignature(body, "abc", "sk_test_secret"), false);
});
test("cart validation", () => {
  const id = "22222222-2222-2222-2222-222222222222";
  assert.deepEqual(cleanCart([{ kind: "ticket", id, qty: 2 }]), [{ kind: "ticket", id, qty: 2 }]);
  for (const bad of [[], null, [{ kind: "ticket", id: "x", qty: 1 }], [{ kind: "ticket", id, qty: 0 }], [{ kind: "ticket", id, qty: 11 }], [{ kind: "gift", id, qty: 1 }], [{ kind: "ticket", id, qty: 1.5 }]])
    assert.throws(() => cleanCart(bad));
});
test("email and reference format", () => {
  assert.ok(isEmail("a@b.co")); assert.ok(!isEmail("nope")); assert.ok(!isEmail("a@b"));
  assert.match(newReference(), /^UK-[A-Z0-9]{8}$/);
});
