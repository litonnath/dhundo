// Confirms the signed-in person's phone from a Firebase Phone Auth ID token.
// POST { idToken }. Google's own lookup API checks the token and gives the phone number;
// it must match the number on the person's account.
// Secrets: FIREBASE_API_KEY (the Web API key of the Firebase project).
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const fbKey = (Deno.env.get("FIREBASE_API_KEY") || "").trim();
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!fbKey) return reply({ ok: false, reason: "not_configured" }, 503);
  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: u } = await asUser.auth.getUser();
  if (!u?.user) return reply({ ok: false, reason: "not_signed_in" }, 401);
  const uid = u.user.id;
  let body: { idToken?: string } = {};
  try { body = await req.json(); } catch (_) { /* empty */ }
  if (!body.idToken) return reply({ ok: false, reason: "bad_request" }, 400);

  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: body.idToken }),
  });
  if (!r.ok) { console.error("firebase lookup failed", r.status); return reply({ ok: false, reason: "bad_token" }, 400); }
  const j = await r.json();
  const fbPhone = String(j?.users?.[0]?.phoneNumber || "").replace(/\D/g, "");
  const admin = createClient(url, serviceKey);
  const { data: su } = await admin.from("services_signups").select("phone").eq("auth_user_id", uid).maybeSingle();
  const mine = String(su?.phone || "").replace(/\D/g, "");
  if (fbPhone.length < 10 || mine.length < 10 || fbPhone.slice(-10) !== mine.slice(-10)) return reply({ ok: false, reason: "phone_mismatch" }, 400);
  const e164 = "+" + (fbPhone.length === 10 ? "91" + fbPhone : fbPhone);
  const { error } = await admin.auth.admin.updateUserById(uid, { phone: e164, phone_confirm: true });
  if (error) { console.error("confirm failed", error.message); return reply({ ok: false, reason: "phone_in_use" }, 409); }
  return reply({ ok: true });
});
