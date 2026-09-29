// ===========================================================================
// referral.js -- remembering who invited somebody, across a sign-up.
//
// THE PROBLEM THIS SOLVES
// A referral link arrives as https://services.shortlistone.com/?ref=Y7RWHJ.
// The person who opens it is not signed in yet, so there is no account to
// attach the code to. They then read the page, maybe close it, come back
// tomorrow, and sign up. By that point the URL is long gone.
//
// So the code is taken out of the URL the moment it arrives and kept in
// localStorage until there is an account to attach it to. It is cleared as
// soon as the database has accepted it, and after thirty days regardless --
// a code sitting in storage for a year, attaching itself to an unrelated
// sign-up, would pay the wrong person.
//
// WHY THE URL IS REWRITTEN
// history.replaceState strips ?ref= after reading it. Otherwise the person
// shares the page from their own browser and passes on their inviter's code
// instead of their own -- which sounds harmless and means one person quietly
// collecting everybody else's ₹3.
// ===========================================================================

const KEY = "dhundo_ref";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Matches the alphabet in 68: no 0/O, 1/I/L, 5/S, 8/B, six characters.
const SHAPE = /^[ACDEFGHJKMNPQRTUVWXYZ23479]{6}$/;

export const cleanCode = (raw) =>
  String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export const codeLooksRight = (raw) => SHAPE.test(cleanCode(raw));

// Called once on load, before anything else looks at the URL.
export function captureFromUrl() {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("ref");
    if (!raw) return null;

    url.searchParams.delete("ref");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);

    const code = cleanCode(raw);
    // A malformed code is dropped rather than stored: it can never succeed,
    // and keeping it would mean a real code arriving later is ignored
    // because this one is already sitting in the slot.
    if (!codeLooksRight(code)) return null;

    window.localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
    return code;
  } catch (_) {
    return null;
  }
}

export function pendingCode() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || !v.code || !codeLooksRight(v.code)) return null;
    if (Date.now() - Number(v.at || 0) > MAX_AGE_MS) { clearCode(); return null; }
    return v.code;
  } catch (_) {
    return null;
  }
}

export function rememberCode(code) {
  try {
    if (!codeLooksRight(code)) return false;
    window.localStorage.setItem(
      KEY, JSON.stringify({ code: cleanCode(code), at: Date.now() })
    );
    return true;
  } catch (_) { return false; }
}

export function clearCode() {
  try { window.localStorage.removeItem(KEY); } catch (_) {}
}

// Attach whatever is pending to the account that is now signed in.
//
// Runs on every sign-in, not only on sign-up: somebody may follow a link,
// sign in to an account they already had, and the database decides whether
// that is allowed (it refuses once they have been referred before, or once
// their listing is already published). The app does not try to guess which
// case it is in -- the rules live in one place, in 68.
//
// Failure is silent on purpose. A person signing up does not need to be told
// "bad_code" about a link somebody else sent them; the sign-up itself
// succeeded, which is what they were trying to do.
export async function redeemPending(api) {
  const code = pendingCode();
  if (!code) return null;
  try {
    const r = await api.applyReferral(code);
    const row = Array.isArray(r) ? r[0] : r;
    if (row && row.ok) { clearCode(); return row.referrer_name || true; }
    // Anything the database calls final -- already referred, too late, or a
    // code that does not exist -- is not worth retrying on every load.
    if (row && ["already_referred", "too_late", "bad_code", "self_referral"]
        .includes(row.reason)) {
      clearCode();
    }
    return null;
  } catch (_) {
    // Offline or a failed request: keep the code and try again next time.
    return null;
  }
}

export const shareUrl = (code) =>
  `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
