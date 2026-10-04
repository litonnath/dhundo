// ===========================================================================
// auth.jsx -- sign up and sign in with a phone number.
//
// WHY A PHONE NUMBER AND NOT AN EMAIL
// The people this app is for -- a mistri, an auto driver, the person hiring
// them -- all have a phone number and use it as their identity everywhere
// else. A good part of them have no email address they check, and some have
// none at all. Asking for one is asking them to leave.
//
// WHY THERE IS STILL AN EMAIL IN HERE
// Only GoTrue can mint a session, and PostgREST only hands out the
// `authenticated` role to a request carrying one. Every function that reveals
// a phone number or writes a listing is granted to that role and nothing
// else. So the number the person types becomes a synthetic address:
//
//     9862012345  ->  919862012345@phone.shortlistone.com
//
// Nothing is ever sent there. It exists so GoTrue has a unique key. The phone
// number itself is stored in services_signups by services_signup_link(),
// which reads auth.uid() from the signed token rather than believing the
// browser.
//
// WHY A 6-DIGIT PIN AND NOT A PASSWORD
// The people signing up here enter a PIN at an ATM and for UPI several times
// a week. They do not have a password manager, and a forgotten password on a
// phone-only account is a permanent lockout -- there is no email to send a
// reset to. A 6-digit number is the one secret this audience already knows
// how to remember and type, and it opens the number pad instead of the full
// keyboard.
//
// It is weaker than a real password, and worth being honest about: 10^6
// combinations. What protects it is that GoTrue rate limits sign-in attempts
// server-side, and that the thing behind the account is a directory listing
// rather than money. If that changes, this is the first decision to revisit.
//
// SIGN-IN accepts anything 6 characters or longer, not just digits: accounts
// made before this change have real passwords and must keep working. Only
// sign-UP insists on 6 digits.
//
// WHAT THIS IS NOT
// It is not OTP. An SMS gateway costs money per message and needs a DLT
// registration in India; a PIN works on day one and costs nothing. When SMS
// is worth paying for, only this file changes -- the database already keys
// on the phone number.
//
// WHY THERE IS NO SHORTLISTONE LOGIN HERE ANY MORE
// Somebody looking for a plumber should not have to hold an account on a
// hiring platform, and the two products should not be able to lock each
// other out. Different table, different accounts, same Postgres.
// ===========================================================================

export const PHONE_DOMAIN = "phone.shortlistone.com";

export const digitsOnly = (s) => String(s || "").replace(/\D/g, "");

// Everything reduces to 91XXXXXXXXXX. People type 9862012345, 09862012345,
// +91 98620 12345 and 98620-12345 and mean the same number; if the app does
// not settle that, one person ends up with four accounts.
export function normalizePhone(raw) {
  let d = digitsOnly(raw);
  if (d.length === 13 && d.startsWith("091")) d = d.slice(1);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return d;
}

// Valid means: 91 plus ten digits, and Indian mobile numbers start 6-9. A
// landline or a typo is caught here rather than at the database, where the
// only available answer is a constraint name.
export function isValidPhone(raw) {
  const d = normalizePhone(raw);
  return /^91[6-9]\d{9}$/.test(d);
}

export function prettyPhone(raw) {
  const d = normalizePhone(raw);
  return d.length === 12 ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : raw || "";
}

const authEmail = (raw) => `${normalizePhone(raw)}@${PHONE_DOMAIN}`;

// ---------------------------------------------------------------------------
function makeSession(tokens, account) {
  return {
    user: {
      id: account.account_id,
      phone: account.phone,
      full_name: account.full_name || null,
      is_admin: !!account.is_admin,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + Number(tokens.expires_in || 3600) * 1000,
  };
}

function makeClient(SUPABASE_URL, SUPABASE_ANON_KEY) {
  const base = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };

  async function gotrue(path, body) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: base,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  async function rpc(name, body, token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { ...base, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // The database's own limit on new accounts per address.
      if (res.status === 429 || (data && data.message === "rate_limited")) throw new Error("RATE_LIMITED");
      throw new Error((data && (data.message || data.error)) || `Request failed (${res.status})`);
    }
    return Array.isArray(data) ? data[0] || null : data;
  }

  return { gotrue, rpc };
}

// ---------------------------------------------------------------------------
// SIGN UP
// ---------------------------------------------------------------------------
export async function signUpWithPhone(cfg, { phone, name, password }) {
  const { gotrue, rpc } = makeClient(cfg.url, cfg.anonKey);

  if (!isValidPhone(phone)) throw new Error("BAD_PHONE");
  // Exactly six digits, on the way in. Anything else and the person would
  // be told "at least 6 characters" and then type a word they will not
  // remember next month.
  if (!/^\d{6}$/.test(String(password || ""))) throw new Error("BAD_PIN");
  if (!String(name || "").trim()) throw new Error("NAME_REQUIRED");

  const up = await gotrue("signup", { email: authEmail(phone), password });

  if (!up.ok) {
    // The sign-up service has its own limit per address; say so plainly.
    if (up.status === 429) throw new Error("RATE_LIMITED");
    const msg = String((up.data && (up.data.msg || up.data.error_description || up.data.message)) || "");
    // GoTrue says "User already registered". In this app that sentence is
    // meaningless -- the person typed a phone number, not an email.
    if (/already registered|already exists/i.test(msg)) throw new Error("PHONE_TAKEN");
    if (/password/i.test(msg)) throw new Error("BAD_PIN");
    throw new Error(msg || "SIGNUP_FAILED");
  }

  // No session back means Supabase is holding the account until the address
  // is confirmed -- and that address is synthetic, so nothing will ever
  // arrive. Named exactly, because the fix is one switch in the dashboard
  // and the symptom otherwise looks like a broken app.
  if (!up.data || !up.data.access_token) throw new Error("CONFIRM_EMAIL_IS_ON");

  const linked = await rpc(
    "services_signup_link",
    { p_phone: normalizePhone(phone), p_full_name: String(name).trim() },
    up.data.access_token
  );

  if (!linked || !linked.ok) {
    // The GoTrue user exists but has no services_signups row, so it can do
    // nothing. Better to say the number is taken than to leave them signed
    // in as an account with no identity.
    if (linked && linked.reason === "blocked") throw new Error("ACCOUNT_BLOCKED");
    throw new Error(linked && linked.reason === "phone_taken" ? "PHONE_TAKEN" : "SIGNUP_FAILED");
  }

  return makeSession(up.data, linked);
}

// ---------------------------------------------------------------------------
// SIGN IN
// ---------------------------------------------------------------------------
export async function signInWithPhone(cfg, { phone, password }) {
  const { gotrue, rpc } = makeClient(cfg.url, cfg.anonKey);

  if (!isValidPhone(phone)) throw new Error("BAD_PHONE");

  const tk = await gotrue("token?grant_type=password", {
    email: authEmail(phone),
    password,
  });

  if (!tk.ok || !tk.data || !tk.data.access_token) {
    if (tk.status === 429) throw new Error("RATE_LIMITED");
    const msg = String((tk.data && (tk.data.error_description || tk.data.msg)) || "");
    if (/confirm/i.test(msg)) throw new Error("CONFIRM_EMAIL_IS_ON");
    // GoTrue deliberately does not say whether it was the number or the
    // password, and neither do we -- that is what stops a stranger using the
    // login form to find out which numbers are registered.
    throw new Error("BAD_CREDENTIALS");
  }

  const me = await rpc("services_me", {}, tk.data.access_token);

  // A GoTrue user with no services_signups row. Two very different things
  // look identical here:
  //
  //   * a sign-up that died between the two calls -- finish it, which is
  //     what this path was written for;
  //   * an account an admin DELETED. The GoTrue user may still exist (71
  //     tries to remove it but that write can be refused), and without the
  //     block list this same recovery would cheerfully rebuild their
  //     account and hand them a second welcome bonus.
  //
  // The database tells them apart, and says 'blocked' for the second. That
  // is surfaced rather than folded into BAD_CREDENTIALS: somebody who was
  // removed deserves to know they were removed, instead of concluding they
  // have forgotten their own PIN and trying twenty more times.
  if (!me || !me.account_id) {
    const linked = await rpc(
      "services_signup_link",
      { p_phone: normalizePhone(phone), p_full_name: null },
      tk.data.access_token
    );
    if (linked && linked.reason === "blocked") throw new Error("ACCOUNT_BLOCKED");
    if (!linked || !linked.ok) throw new Error("BAD_CREDENTIALS");
    return makeSession(tk.data, linked);
  }

  return makeSession(tk.data, me);
}

// ---------------------------------------------------------------------------
// A stored token that is still in date may still be dead -- signed out
// elsewhere, or the account removed. Asking the server once on load costs one
// request and avoids a page that looks signed in and 401s on every action.
// ---------------------------------------------------------------------------
export async function refreshAccount(cfg, session) {
  if (!session || !session.access_token) return null;
  try {
    const { rpc } = makeClient(cfg.url, cfg.anonKey);
    const me = await rpc("services_me", {}, session.access_token);
    if (!me || !me.account_id) return null;
    return {
      ...session,
      user: {
        id: me.account_id,
        phone: me.phone,
        full_name: me.full_name || null,
        is_admin: !!me.is_admin,
      },
    };
  } catch (_) {
    // Offline. Keep what we have rather than signing them out on a bad
    // train connection.
    return session;
  }
}

export async function signOutEverywhere(cfg, session) {
  if (!session || !session.access_token) return;
  try {
    await fetch(`${cfg.url}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch (_) {
    // The local session is cleared regardless; this is only tidying up
    // GoTrue's side.
  }
}
