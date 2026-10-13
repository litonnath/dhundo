// Phone check with Firebase Phone Auth: Google sends the SMS (no DLT needed) and
// the person types the 6-digit code. Firebase is loaded only when the sheet opens.
// Config goes in src/config.js:  export const FIREBASE_CONFIG = { apiKey, authDomain, projectId, appId };
import * as CONF from "./config.js";

export const firebaseConfigured = () => !!(CONF.FIREBASE_CONFIG && CONF.FIREBASE_CONFIG.apiKey);

let state = null;   // { auth, verifier, authMod, confirmation, fresh }

// Loads Firebase and prepares the invisible reCAPTCHA ahead of time, so the tap on
// "Send code" does not wait for the downloads.
export async function fbWarm(box) {
  if (!firebaseConfigured() || !box) return;
  const [{ initializeApp, getApps }, authMod] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const app = getApps().length ? getApps()[0] : initializeApp(CONF.FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  auth.useDeviceLanguage();
  if (state && state.verifier) { try { state.verifier.clear(); } catch (_) { /* gone */ } }
  const verifier = new authMod.RecaptchaVerifier(auth, box, { size: "invisible" });
  state = { auth, verifier, authMod, confirmation: null, fresh: true };
  try { await verifier.render(); } catch (_) { /* it renders again on send */ }
}

// phone like +919876543210; box is a DOM element for the invisible reCAPTCHA.
export async function fbSendCode(phone, box) {
  if (!state || !state.fresh) await fbWarm(box);     // a verifier is used once; make a new one
  const s = state;
  s.fresh = false;
  try {
    s.confirmation = await s.authMod.signInWithPhoneNumber(s.auth, phone, s.verifier);
  } catch (e) {
    fbWarm(box);   // get a clean verifier ready for the next try
    throw e;
  }
  return true;
}

// Returns a Firebase ID token for the confirmed phone, to be checked by our server.
export async function fbConfirmCode(code) {
  if (!state || !state.confirmation) throw new Error("no_code_sent");
  const cred = await state.confirmation.confirm(code);
  return cred.user.getIdToken();
}
