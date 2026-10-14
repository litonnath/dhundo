// Sets a new PIN for a person who forgot it, after they proved the phone number with a Firebase SMS code.
// POST { idToken, newPin }  -- idToken is the Firebase token from confirming the SMS code.
// Google's lookup API checks the token and gives the verified phone number. The sign-in account of that
// number gets the new PIN as its password. Not signed in, so deploy with: supabase functions deploy pin-reset --no-verify-jwt
// Secrets: FIREBASE_API_KEY (the same one phone-firebase uses).
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const fbKey = (Deno.env.get("FIREBASE_API_KEY") || "").trim();
const DOMAIN = "phone.shortlistone.com";   // the same domain src/auth.jsx builds the sign-in email from
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ ok: false, reason: "bad_request" }, 405);
  if (!fbKey) return reply({ ok: false, reason: "not_configured" }, 503);
  let body: { idToken?: string; newPin?: string } = {};
  try { body = await req.json(); } catch (_) { /* empty */ }
  const pin = String(body.newPin || "");
  if (!body.idToken || !/^\d{6}$/.test(pin)) return reply({ ok: false, reason: "bad_request" }, 400);

  const admin = createClient(url, serviceKey);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "none";
  const lim = await admin.rpc("services_rate_hit", { p_key: "pinreset:ip:" + ip, p_limit: 20, p_window: 3600 });
  if (lim.data === false) return reply({ ok: false, reason: "limit" }, 429);

  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: body.idToken }),
  });
  if (!r.ok) return reply({ ok: false, reason: "bad_token" }, 400);
  const j = await r.json();
  const user = j?.users?.[0];
  let digits = String(user?.phoneNumber || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (!/^91[6-9]\d{9}$/.test(digits)) return reply({ ok: false, reason: "bad_token" }, 400);
  // the code must have been confirmed just now, not an old token kept around
  if (!(Date.now() - Number(user?.lastLoginAt || 0) < 10 * 60 * 1000)) return reply({ ok: false, reason: "expired" }, 400);

  const lim2 = await admin.rpc("services_rate_hit", { p_key: "pinreset:phone:" + digits, p_limit: 5, p_window: 3600 });
  if (lim2.data === false) return reply({ ok: false, reason: "limit" }, 429);

  const { data: uid } = await admin.rpc("services_pin_reset_target", { p_email: `${digits}@${DOMAIN}` });
  if (!uid) return reply({ ok: false, reason: "no_account" }, 404);
  const { error } = await admin.auth.admin.updateUserById(uid as string, { password: pin });
  if (error) { console.error("pin reset failed", error.message); return reply({ ok: false, reason: "save_failed" }, 500); }
  return reply({ ok: true });
});
