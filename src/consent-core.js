// ---------------------------------------------------------------------------
// CONSENT -- what the person has agreed to, and the one way to ask.
//
// Six purposes, each one a different kind of data:
//   location  the phone's position, for "near me" and distances
//   live      the worker's position while "Available now" is on
//   account   name, phone number and PIN (asked at sign-up)
//   listing   the public listing: name, work, area, photo, ID photo
//   market    an item for sale
//   profile   email, address, town, PIN code
//
// The answer is kept here, on the device, and for a signed-in person it is
// also recorded in the database (services_record_consent). The database is
// the one that enforces it: it refuses a listing, an item, a live position or
// a profile address with no consent on record, however the request got there.
// This file is only the part that asks nicely first.
//
// No UI is imported here, so device.jsx can use it without a circular import;
// the sheet and the provider are in consent-ui.jsx.
// ---------------------------------------------------------------------------
import { createContext, useContext } from "react";

// Raise when what a purpose covers changes: everybody is asked again.
export const CONSENT_VERSION = 1;
export const PURPOSES = ["location", "live", "account", "listing", "market", "profile"];
// Answered once per device, never carried to another: the browser's own
// permission works that way too.
export const DEVICE_ONLY = ["location", "live"];
export const CONSENT_EVENT = "dhundo:consent";
const KEY = "dhundo_consent";

// Private windows can refuse storage; the answer then lasts until the page
// is closed, which means asking again next time rather than assuming yes.
let mem = {};

function readAll() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : {};
    if (o && typeof o === "object") { mem = o; return o; }
  } catch (_) {}
  return mem;
}

function writeAll(o) {
  mem = o;
  try { window.localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {}
}

// { granted, at, v } or null when never answered.
export function getLocal(purpose) {
  const r = readAll()[purpose];
  return r && typeof r.granted === "boolean" ? r : null;
}

export function hasLocal(purpose) {
  const r = getLocal(purpose);
  return !!(r && r.granted && (r.v || 1) >= CONSENT_VERSION);
}

export function setLocal(purpose, granted, at = Date.now()) {
  const o = { ...readAll() };
  o[purpose] = { granted: !!granted, at, v: CONSENT_VERSION };
  writeAll(o);
}

// Safe without a provider (a test, a stray import): asking just reports what
// is on record, so nothing is ever collected on the strength of a missing UI.
export const ConsentCtx = createContext({
  has: hasLocal,
  ask: async (p) => hasLocal(p),
  grant: async () => {},
  withdraw: async () => {},
  tick: 0,
});

export const useConsent = () => useContext(ConsentCtx);
