// Phone check with Firebase Phone Auth: Google sends the SMS (no DLT needed) and
// the person types the 6-digit code. Firebase is loaded only when the sheet opens.
// Config goes in src/config.js:  export const FIREBASE_CONFIG = { apiKey, authDomain, projectId, appId };
import * as CONF from "./config.js";

export const firebaseConfigured = () => !!(CONF.FIREBASE_CONFIG && CONF.FIREBASE_CONFIG.apiKey);

let state = null;   // { auth, verifier, confirmation }

async function boot(box) {
  const [{ initializeApp, getApps }, authMod] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const app = getApps().length ? getApps()[0] : initializeApp(CONF.FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  auth.useDeviceLanguage();
  if (state && state.verifier) { try { state.verifier.clear(); } catch (_) { /* gone */ } }
  const verifier = new authMod.RecaptchaVerifier(auth, box, { size: "invisible" });
  state = { auth, verifier, authMod, confirmation: null };
  return state;
}

// phone like +919876543210; box is a DOM element for the invisible reCAPTCHA.
export async function fbSendCode(phone, box) {
  const s = await boot(box);
  s.confirmation = await s.authMod.signInWithPhoneNumber(s.auth, phone, s.verifier);
  return true;
}

// Returns a Firebase ID token for the confirmed phone, to be checked by our server.
export async function fbConfirmCode(code) {
  if (!state || !state.confirmation) throw new Error("no_code_sent");
  const cred = await state.confirmation.confirm(code);
  return cred.user.getIdToken();
}
