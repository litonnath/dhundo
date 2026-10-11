// Creates a Razorpay order for something the signed-in person owes: an order,
// a ride fare or an item. The amount is read from the database by
// services_payment_prepare (as that person), never from the request.
// Secrets (Supabase > Edge Functions > Secrets): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!keyId || !keySecret) return reply({ ok: false, reason: "not_configured" }, 503);
  const auth = req.headers.get("Authorization") || "";
  const body = await req.json().catch(() => null);
  const purpose = String(body && body.purpose || "");
  const ref = String(body && body.ref || "");
  if (!auth || !purpose || !ref) return reply({ ok: false, reason: "bad_request" }, 400);

  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data, error } = await asUser.rpc("services_payment_prepare", { p_purpose: purpose, p_ref: ref });
  const prep = Array.isArray(data) ? data[0] : data;
  if (error || !prep || !prep.ok) return reply({ ok: false, reason: (prep && prep.reason) || "not_payable" }, 400);

  const rp = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
    body: JSON.stringify({
      amount: prep.amount_paise, currency: "INR", receipt: `${purpose}-${ref}`.slice(0, 40),
      notes: { purpose, ref, account: prep.account_id },
    }),
  });
  const order = await rp.json().catch(() => null);
  if (!rp.ok || !order || !order.id) return reply({ ok: false, reason: "gateway_error" }, 502);

  const admin = createClient(url, serviceKey);
  const rec = await admin.rpc("services_payment_record", {
    p_account: prep.account_id, p_purpose: purpose, p_ref: ref, p_amount: prep.amount_paise, p_rp_order: order.id,
  });
  if (rec.error) return reply({ ok: false, reason: "record_failed" }, 500);
  return reply({ ok: true, key_id: keyId, order_id: order.id, amount: prep.amount_paise });
});
