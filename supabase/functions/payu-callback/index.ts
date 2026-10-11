// PayU sends the customer's browser here after paying (surl and furl), and
// can also call it as a webhook. The response hash is checked with the salt
// before anything is trusted; then a successful payment is marked paid through
// services_payment_mark_paid (service role only) and the person is sent back
// to the app. Deploy with: supabase functions deploy payu-callback --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const key = (Deno.env.get("PAYU_KEY") || "").trim();
const salt = (Deno.env.get("PAYU_SALT") || "").trim();
const sha512 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((n, c, i) => n | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

Deno.serve(async (req) => {
  const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/+$/, "");
  if (!key || !salt || !appUrl) return new Response("not configured", { status: 503 });
  const form = await req.formData().catch(() => null);
  if (!form) return new Response("bad request", { status: 400 });
  const f = (k: string) => String(form.get(k) ?? "");
  const status = f("status"), txnid = f("txnid");
  // The reverse hash PayU sends back.
  const seq = [salt, status, f("udf10"), f("udf9"), f("udf8"), f("udf7"), f("udf6"), f("udf5"), f("udf4"), f("udf3"), f("udf2"), f("udf1"),
    f("email"), f("firstname"), f("productinfo"), f("amount"), txnid, key].join("|");
  const expect = await sha512(f("additionalCharges") ? f("additionalCharges") + "|" + seq : seq);
  const purpose = f("udf1"), ref = f("udf2");
  let result = "failed";
  if (f("hash") && same(expect, f("hash").toLowerCase()) && status === "success") {
    const admin = createClient(url, serviceKey);
    const cents = Math.round(parseFloat(f("amount")) * 100);
    const { data, error } = await admin.rpc("services_payment_mark_paid", { p_rp_order: txnid, p_rp_payment: f("mihpayid") || null, p_amount: cents });
    if (!error && (data === "paid" || data === "already")) result = "ok";
  }
  const back = `${appUrl}/?pay=${result}&purpose=${encodeURIComponent(purpose)}&ref=${encodeURIComponent(ref)}`;
  return new Response(null, { status: 303, headers: { Location: back } });
});
