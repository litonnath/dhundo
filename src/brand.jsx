// ===========================================================================
// brand.jsx -- Dhundo.
//
// THE NAME
// ढूंढो -- "find", in the imperative. It is a whole sentence: the thing you
// say to the app and the thing the app does. The wordmark stays in Latin
// script in all three languages, the way Zomato and Rapido do -- a brand
// people say out loud is better off looking the same on a shopfront sticker,
// a WhatsApp forward and a phone home screen than being transliterated three
// ways. The tagline under it IS translated, because that is information
// rather than a name.
//
// THE MARK
// Liton's logo: a magnifying glass with three workers inside it and three
// orange rays. It is his file, not a redrawing of it -- a hand-traced copy
// would drift from the original the first time either changed.
//
// WHY IT IS BASE64 AND NOT A FILE
// It shipped as /logo-mark.png first, and on the server it arrived out of a
// Windows zip as mode 700 root:root. nginx runs as www-data, so the browser
// got a 403 and drew a broken-image box where the brand should be -- while
// the rest of the page loaded perfectly, which is what made it puzzling.
//
// A logo is not worth a network request that can fail in a way nobody
// notices until a screenshot arrives. Quantised to 32 colours at 144px --
// enough for a 34px slot on a 3x screen -- the whole thing is 3.5 KB, less
// than the HTTP round trip it replaces. It cannot 403, cannot 404, and
// cannot be held by a stale service worker.
//
// The full-size public/logo-mark.png stays for the app icons and the
// manifest: those are fetched by the operating system at install time, and
// if they fail the page still renders.
// ===========================================================================
import React from "react";

export const BRAND = {
  blue:     "#054291",   // sampled from the logo file, not guessed alongside it
  blueDeep: "#032C61",
  blueMid:  "#0A5BB8",
  blueSoft: "#E8F0FB",
  orange:   "#F87617",
  orangeSoft: "#FFF0E2",
};

export const LOGO_SRC = "data:image/png;base64,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";

export function DhundoGlyph({ size = 24 }) {
  return (
    <img src={LOGO_SRC} alt="" width={size} height={size}
         style={{ display: "block", objectFit: "contain" }} />
  );
}

// Mark + wordmark. `tagline` is optional and is left off in tight rows,
// where it costs ~70px that the location control needs more.
// How people reach Dhundo, shown in the page footer. Fill these in and the
// footer's "Help & contact" column appears; leave them empty and it stays
// hidden rather than showing a number nobody answers.
//   phone:    "+91 98620 12345"   (shown as written, dialled without spaces)
//   whatsapp: "919862012345"      (country code, digits only)
//   email:    "help@example.com"
export const CONTACT = {
  phone: "",
  whatsapp: "919560677568",
  email: "",
};

export function DhundoLogo({ size = 34, showWord = true, tagline = null, ink = "#0F1419" }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <img src={LOGO_SRC} alt="Dhundo" width={size} height={size}
           style={{ display: "block", objectFit: "contain", flexShrink: 0 }} />
      {showWord && (
        <span style={{ textAlign: "left", lineHeight: 1.1 }}>
          <span style={{
            display: "block", fontSize: size * 0.56, fontWeight: 800,
            color: BRAND.blue, letterSpacing: -0.4, whiteSpace: "nowrap",
          }}>Dhundo</span>
          {tagline && (
            <span style={{
              display: "block", fontSize: Math.max(9.5, size * 0.29),
              color: "rgba(15,20,25,0.5)", fontWeight: 600, whiteSpace: "nowrap",
            }}>{tagline}</span>
          )}
        </span>
      )}
    </span>
  );
}
