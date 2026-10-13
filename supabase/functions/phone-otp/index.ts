// Checks a person's phone with a 6-digit code sent over WhatsApp (Meta Cloud API,
// authentication template, no DLT). POST { action: "send" } then { action: "verify", code }.
// The number is read from the signed-in person's own sign-up, never from the request.
// Secrets: WA_TOKEN (permanent access token), WA_PHONE_ID (sender phone number id),
// WA_TEMPLATE (approved authentication template name), optional WA_LANG (default en),
// OTP_SECRET (any long random text, used to hash codes).
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const waToken = (Deno.env.get("WA_TOKEN") || "").trim();
const waPhone = (Deno.env.get("WA_PHONE_ID") || "").trim();
const waTpl = (Deno.env.get("WA_TEMPLATE") || "").trim();
const waLang = (Deno.env.get("WA_LANG") || "en").trim();
const secret = Deno.env.get("OTP_SECRET") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });
const sha = async (t: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!waToken || !waPhone || !waTpl || !secret) return reply({ ok: false, reason: "not_configured" }, 503);
  const auth = req.headers.get("Authorization") || "";
  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u } = await asUser.auth.getUser();
  if (!u?.user) return reply({ ok: false, reason: "not_signed_in" }, 401);
  const uid = u.user.id;
  const admin = createClient(url, serviceKey);
  const { data: su } = await admin.from("services_signups").select("phone").eq("auth_user_id", uid).maybeSingle();
  const digits = String(su?.phone || "").replace(/\D/g, "");
  if (digits.length < 10) return reply({ ok: false, reason: "no_phone" }, 400);
  const e164 = digits.length === 10 ? "91" + digits : digits;
  let body: { action?: string; code?: string } = {};
  try { body = await req.json(); } catch (_) { /* empty */ }

  if (body.action === "send") {
    const { data: old } = await admin.from("services_phone_otps").select("*").eq("auth_user_id", uid).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    if (old && Date.now() - new Date(old.sent_at).getTime() < 40_000) return reply({ ok: false, reason: "too_soon" }, 429);
    const count = old && old.day === today ? old.sent_today : 0;
    if (count >= 5) return reply({ ok: false, reason: "limit" }, 429);
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const r = await fetch(`https://graph.facebook.com/v20.0/${waPhone}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${waToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: e164, type: "template",
        template: { name: waTpl, language: { code: waLang }, components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ] },
      }),
    });
    if (!r.ok) {
      let detail = "";
      try { const j = await r.json(); detail = String(j?.error?.message || ""); } catch (_) { /* no body */ }
      console.error("whatsapp send failed", r.status, detail);
      return reply({ ok: false, reason: "send_failed", detail }, 502);
    }
    const { error: saveErr } = await admin.from("services_phone_otps").upsert({
      auth_user_id: uid, phone: e164, code_hash: await sha(`${secret}:${uid}:${code}`),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), tries: 0,
      sent_at: new Date().toISOString(), sent_today: count + 1, day: today,
    });
    if (saveErr) { console.error("save code failed", saveErr.message); return reply({ ok: false, reason: "db_error", detail: saveErr.message }, 500); }
    return reply({ ok: true });
  }

  if (body.action === "verify") {
    const code = String(body.code || "").replace(/\D/g, "");
    const { data: row } = await admin.from("services_phone_otps").select("*").eq("auth_user_id", uid).maybeSingle();
    if (!row || row.phone !== e164 || new Date(row.expires_at).getTime() < Date.now() || row.tries >= 5)
      return reply({ ok: false, reason: "expired" }, 400);
    if (row.code_hash !== await sha(`${secret}:${uid}:${code}`)) {
      await admin.from("services_phone_otps").update({ tries: row.tries + 1 }).eq("auth_user_id", uid);
      return reply({ ok: false, reason: "bad_code" }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(uid, { phone: e164, phone_confirm: true });
    if (error) return reply({ ok: false, reason: "phone_in_use" }, 409);
    await admin.from("services_phone_otps").delete().eq("auth_user_id", uid);
    return reply({ ok: true });
  }
  return reply({ ok: false, reason: "bad_request" }, 400);
});
