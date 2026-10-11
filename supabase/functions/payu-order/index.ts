// Starts a PayU payment for something the signed-in person owes: an order, a
// ride fare or an item. The amount is read from the database by
// services_payment_prepare (as that person), never from the request. Returns
// the form fields the app posts to PayU.
// Secrets: PAYU_KEY, PAYU_SALT, APP_URL (for example https://dhundo.in).
// Optional: PAYU_BASE (default live https://secure.payu.in/_payment; test
// https://test.payu.in/_payment), PAYU_FALLBACK_EMAIL.
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const key = Deno.env.get("PAYU_KEY") || "";
const salt = Deno.env.get("PAYU_SALT") || "";
const base = Deno.env.get("PAYU_BASE") || "https://secure.payu.in/_payment";
const fallbackEmail = Deno.env.get("PAYU_FALLBACK_EMAIL") || "customer@dhundo.in";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });
const sha512 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/+$/, "");
  if (!key || !salt || !appUrl) return reply({ ok: false, reason: "not_configured" }, 503);
  const auth = req.headers.get("Authorization") || "";
  const body = await req.json().catch(() => null);
  const purpose = String(body && body.purpose || "");
  const ref = String(body && body.ref || "");
  if (!auth || !purpose || !ref) return reply({ ok: false, reason: "bad_request" }, 400);

  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data, error } = await asUser.rpc("services_payment_prepare", { p_purpose: purpose, p_ref: ref });
  const prep = Array.isArray(data) ? data[0] : data;
  if (error || !prep || !prep.ok) return reply({ ok: false, reason: (prep && prep.reason) || "not_payable" }, 400);

  const admin = createClient(url, serviceKey);
  const { data: who } = await admin.from("services_signups").select("full_name, phone, email").eq("id", prep.account_id).maybeSingle();
  const txnid = ("D" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 25);
  const amount = (prep.amount_paise / 100).toFixed(2);
  const productinfo = purpose;
  const firstname = String((who && who.full_name) || "Customer").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 40) || "Customer";
  const email = (who && who.email) || fallbackEmail;
  const phone = String((who && who.phone) || "").replace(/\D/g, "").slice(-10);
  const udf1 = purpose, udf2 = ref;
  const hash = await sha512([key, txnid, amount, productinfo, firstname, email, udf1, udf2, "", "", "", "", "", "", "", salt].join("|"));

  const rec = await admin.rpc("services_payment_record", {
    p_account: prep.account_id, p_purpose: purpose, p_ref: ref, p_amount: prep.amount_paise, p_rp_order: txnid,
  });
  if (rec.error) return reply({ ok: false, reason: "record_failed" }, 500);

  const cb = `${url}/functions/v1/payu-callback`;
  return reply({
    ok: true, action: base,
    fields: { key, txnid, amount, productinfo, firstname, email, phone, surl: cb, furl: cb, hash, udf1, udf2 },
  });
});
