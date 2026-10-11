// Razorpay calls this when a payment succeeds. The signature is checked with
// RAZORPAY_WEBHOOK_SECRET before anything is trusted; then the payment is
// marked paid through services_payment_mark_paid (service role only).
// Deploy with: supabase functions deploy razorpay-webhook --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || "";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sign(text: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
}
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((n, c, i) => n | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

Deno.serve(async (req) => {
  if (!secret) return new Response("not configured", { status: 503 });
  const raw = await req.text();
  const got = req.headers.get("x-razorpay-signature") || "";
  if (!got || !same(await sign(raw), got)) return new Response("bad signature", { status: 401 });
  let ev: any;
  try { ev = JSON.parse(raw); } catch (_) { return new Response("bad json", { status: 400 }); }
  if (ev.event !== "payment.captured" && ev.event !== "order.paid") return new Response("ignored", { status: 200 });
  const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
  const ord = ev.payload && ev.payload.order && ev.payload.order.entity;
  const orderId = (pay && pay.order_id) || (ord && ord.id);
  const paymentId = pay && pay.id;
  const amount = (pay && pay.amount) || (ord && ord.amount_paid) || null;
  if (!orderId) return new Response("no order", { status: 200 });
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.rpc("services_payment_mark_paid", { p_rp_order: orderId, p_rp_payment: paymentId || null, p_amount: amount });
  if (error) return new Response("error", { status: 500 });
  return new Response(String(data), { status: 200 });
});
