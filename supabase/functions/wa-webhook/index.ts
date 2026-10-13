// Receives WhatsApp messages from Meta. A person who sends the code shown in the app
// from the phone number on their account has proved the number is theirs.
// Deploy with: supabase functions deploy wa-webhook --no-verify-jwt   (Meta sends no login)
// Secrets: WA_VERIFY_TOKEN (text you choose, also typed into Meta), WA_APP_SECRET (Meta app secret).
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const verifyToken = Deno.env.get("WA_VERIFY_TOKEN") || "";
const appSecret = Deno.env.get("WA_APP_SECRET") || "";

const hmacHex = async (key: string, text: string) => {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (req.method === "GET") {
    // Meta's one-time check when the webhook is saved.
    if (verifyToken && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === verifyToken)
      return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
    return new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST" || !appSecret) return new Response("no", { status: 403 });
  const raw = await req.text();
  const sent = (req.headers.get("x-hub-signature-256") || "").replace("sha256=", "");
  const want = await hmacHex(appSecret, raw);
  let diff = sent.length ^ want.length;                       // compare without stopping at the first difference
  for (let i = 0; i < want.length; i++) diff |= (sent.charCodeAt(i) || 0) ^ want.charCodeAt(i);
  if (!sent || diff !== 0) return new Response("bad signature", { status: 403 });

  let body: any = {};
  try { body = JSON.parse(raw); } catch (_) { return new Response("ok"); }
  const admin = createClient(url, serviceKey);
  for (const entry of body.entry || []) for (const ch of entry.changes || []) {
    for (const m of ch.value?.messages || []) {
      const from = String(m.from || "").replace(/\D/g, "");
      const code = String(m.text?.body || "").match(/\b(\d{6})\b/)?.[1];
      if (!from || !code) continue;
      const { data: rows } = await admin.from("services_phone_claims").select("*").eq("code", code);
      for (const row of rows || []) {
        if (new Date(row.expires_at).getTime() < Date.now()) continue;
        if (String(row.phone).slice(-10) !== from.slice(-10)) continue;   // must come from that very number
        const { error } = await admin.auth.admin.updateUserById(row.auth_user_id, { phone: row.phone, phone_confirm: true });
        if (error) { console.error("confirm failed", error.message); continue; }
        await admin.from("services_phone_claims").delete().eq("auth_user_id", row.auth_user_id);
      }
    }
  }
  return new Response("ok");   // always 200 so Meta does not retry
});
