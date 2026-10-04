// Alerts when the app is closed (web push). Always started by a tap, never
// on load, and the phone's own permission box has the last word. What we keep
// on the server is an address and two keys for this phone, nothing more.
import * as CONF from "./config.js";

export const vapidKey = () => CONF.VAPID_PUBLIC_KEY || "";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window &&
         "Notification" in window && !!vapidKey();
}

const b64 = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch (_) { return "off"; }
}

// Returns "on", "denied" or "error".
export async function enablePush(api, lang) {
  if (!pushSupported()) return "error";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapidKey()) });
    const j = sub.toJSON();
    const keys = j.keys || { p256dh: toB64(sub.getKey("p256dh")), auth: toB64(sub.getKey("auth")) };
    await api.pushSubscribe(j.endpoint, keys.p256dh, keys.auth, lang);
    return "on";
  } catch (_) { return "error"; }
}

export async function disablePush(api) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await api.pushUnsubscribe(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
  } catch (_) { /* nothing to undo */ }
}
