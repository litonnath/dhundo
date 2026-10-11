// Checks your PayU key, salt and address WITHOUT the app: it sends a tiny test
// payment request to PayU and tells you if PayU accepts the hash.
//   PAYU_KEY=... PAYU_SALT=... PAYU_BASE=https://test.payu.in/_payment node scripts/payu-check.mjs
// (Leave PAYU_BASE out for live.) Nothing is charged: PayU only shows its page.
import { createHash } from "node:crypto";

const key = process.env.PAYU_KEY || "";
const salt = process.env.PAYU_SALT || "";
const base = process.env.PAYU_BASE || "https://secure.payu.in/_payment";
if (!key || !salt) { console.error("Set PAYU_KEY and PAYU_SALT first."); process.exit(1); }

const txnid = "chk" + Date.now().toString(36);
const f = { key, txnid, amount: "10.00", productinfo: "check", firstname: "Test", email: "test@example.com", udf1: "a", udf2: "b" };
const seq = [f.key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, f.udf1, f.udf2, "", "", "", "", "", "", "", "", salt];
const hash = createHash("sha512").update(seq.join("|")).digest("hex");
const body = new URLSearchParams({ ...f, phone: "9999999999", surl: "https://example.com/ok", furl: "https://example.com/fail", hash });

console.log("Address:", base);
console.log("Key:", key.slice(0, 3) + "...(" + key.length + " chars)", " Salt length:", salt.length);
let res;
try { res = await fetch(base, { method: "POST", body, redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" } }); }
catch (e) { console.error("Could not reach PayU from this computer:", e && e.cause && e.cause.code ? e.cause.code : e.message); process.exit(4); }
const text = await res.text().catch(() => "");
console.log("PayU answered with status", res.status);
if (/incorrectly calculated hash/i.test(text)) {
  console.log("RESULT: PayU rejected the hash. The key, the salt or the address (test or live) does not match.");
  console.log("Check: key and salt from the same mode (Test or Live) as the address; the right salt if PayU shows two; no spaces or quotes.");
  process.exit(2);
}
if (res.status >= 300 && res.status < 400) { console.log("RESULT: PayU accepted the request (it redirected to its payment page). Your key, salt and address match."); process.exit(0); }
if (/invalid merchant key|merchant key/i.test(text)) { console.log("RESULT: PayU does not recognise the merchant key (test key on the live address, or the other way round)."); process.exit(3); }
console.log("RESULT: not clear. First 300 characters of PayU's answer:\n" + text.replace(/\s+/g, " ").slice(0, 300));
