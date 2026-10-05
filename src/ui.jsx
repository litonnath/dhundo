// ===========================================================================
// ui.jsx -- the visual layer for the services directory.
//
// Split out from services.jsx so the data path and the look can change
// independently. Nothing here calls the network.
//
// WHY IT LOOKS THE WAY IT DOES
// The audience is on a cheap Android on a slow connection, often reading
// Bengali more comfortably than English, and deciding in about two seconds
// whether this is a real service or a dead page. So:
//
//   * a coloured hero, because a wall of white tiles reads as unfinished
//   * line icons rather than emoji -- emoji render differently on every
//     device and look like a placeholder someone forgot to replace
//   * no "Coming soon" anywhere. An empty category should be quiet, not
//     apologetic; stamping it eight times tells a first visitor to leave
//   * large tap targets (44px minimum) and no hover-only affordances
//   * everything inline, no icon library, no font download -- the whole
//     bundle stays small enough to open on a 3G connection
// ===========================================================================
import React, { useState } from "react";
import { useI18n, LANGS, STATES, DEFAULT_STATE, stateName, tradeName } from "./i18n.jsx";
import { REGIONS, searchPlaces, isKnownPlace, snapToKnown, searchRemote, placeCoords, nearestPlaces, bestNearName, pinLookup, pinForPlace } from "./regions.js";
import { useMyLocation, useInstallPrompt, isInstalledApp, locErrorKey } from "./device.jsx";
import { useConsent } from "./consent-core.js";
import { DhundoLogo, DhundoGlyph, CONTACT } from "./brand.jsx";
// auth.jsx imports nothing from here, so this does not make a cycle.
import { prettyPhone } from "./auth.jsx";
import { tradeKeysFor } from "./tradewords.js";
import { tradeIcon, vividFor } from "./tradeicons.js";

export const T = {
  ink: "#0F1419",
  inkSoft: "rgba(15,20,25,0.62)",
  inkFaint: "rgba(15,20,25,0.42)",
  line: "rgba(15,20,25,0.09)",
  paper: "#F6F8FA",
  white: "#FFFFFF",
  // Sampled from the logo file rather than chosen alongside it. The teal
  // this app started with sat badly next to the mark's blue, and two blues
  // that are almost the same read as a mistake rather than as a palette.
  brand: "#0A5BB8",
  brandDark: "#054291",
  brandDeep: "#032C61",
  brandSoft: "#E8F0FB",
  accent: "#F87617",
  accentSoft: "#FFF0E2",
  green: "#12804A",
  greenSoft: "#E6F5EC",
  amber: "#B26A00",
  red: "#C43D2E",
  redSoft: "#FDECEA",
};

// --------------------------------------------------------------------- icons
// 24x24, stroke-based, inherit currentColor. Drawn rather than imported so
// there is no icon package in the bundle.
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };

export function Icon({ name, size = 24, style }) {
  const paths = {
    construction: <><rect {...P} x="3" y="6" width="8" height="5" rx="1" /><rect {...P} x="13" y="6" width="8" height="5" rx="1" /><rect {...P} x="8" y="13" width="8" height="5" rx="1" /><path {...P} d="M3 21h18" /></>,
    drivers: <><path {...P} d="M5 17h14" /><path {...P} d="M4 17v-4l2-5h12l2 5v4" /><circle {...P} cx="7.5" cy="17.5" r="1.6" /><circle {...P} cx="16.5" cy="17.5" r="1.6" /></>,
    home: <><path {...P} d="M4 11l8-6 8 6v9H4z" /><path {...P} d="M10 20v-5h4v5" /></>,
    food: <><path {...P} d="M4 8h16" /><path {...P} d="M6 8c0 5 2 8 6 8s6-3 6-8" /><path {...P} d="M12 16v4" /><path {...P} d="M8 20h8" /></>,
    repairs: <><path {...P} d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8-2-2 8-8" /><path {...P} d="M6 6l4 4" /><path {...P} d="M3 9l6-6 2 2-6 6z" /></>,
    vehicle: <><circle {...P} cx="12" cy="12" r="8" /><circle {...P} cx="12" cy="12" r="2.6" /><path {...P} d="M12 4v3M12 17v3M4 12h3M17 12h3" /></>,
    events: <><path {...P} d="M4 20l5-14 9 9-14 5z" /><path {...P} d="M14 4l1.5 1.5M19 6l1 1M17 10l2 .5" /></>,
    suppliers: <><path {...P} d="M4 9h16l-1 11H5z" /><path {...P} d="M4 9l2-4h12l2 4" /><path {...P} d="M9 13h6" /></>,
    other: <><rect {...P} x="4" y="4" width="16" height="16" rx="3" /><path {...P} d="M8 10h8M8 14h5" /></>,
    search: <><circle {...P} cx="11" cy="11" r="6.5" /><path {...P} d="M16 16l4 4" /></>,
    pin: <><path {...P} d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" /><circle {...P} cx="12" cy="10" r="2.4" /></>,
    phone: <><path {...P} d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.2 2 2 0 0 1 6 3z" /></>,
    check: <><circle {...P} cx="12" cy="12" r="8.5" /><path {...P} d="M8.5 12.2l2.4 2.4 4.6-5" /></>,
    back: <><path {...P} d="M15 5l-7 7 7 7" /></>,
    tag: <><path {...P} d="M3 12V4h8l10 10-8 8z" /><circle {...P} cx="7.5" cy="8.5" r="1.5" /></>,
    camera: <><path {...P} d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle {...P} cx="12" cy="13" r="3.5" /></>,
    flag: <><path {...P} d="M5 21V4" /><path {...P} d="M5 4h11l-2 4 2 4H5" /></>,
    eye: <><path {...P} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle {...P} cx="12" cy="12" r="2.8" /></>,
    clock: <><circle {...P} cx="12" cy="12" r="8.5" /><path {...P} d="M12 7.5V12l3 2" /></>,
    plus: <><path {...P} d="M12 5v14M5 12h14" /></>,
    close: <><path {...P} d="M6 6l12 12M18 6L6 18" /></>,
    globe: <><circle {...P} cx="12" cy="12" r="8.5" /><path {...P} d="M3.5 12h17" /><path {...P} d="M12 3.5c2.2 2.4 3.3 5.4 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.4-3.3-8.5S9.8 5.9 12 3.5z" /></>,
    download: <><path {...P} d="M12 4v10" /><path {...P} d="M8.2 10.5L12 14.3l3.8-3.8" /><path {...P} d="M5 18.5h14" /></>,
    trash: <><path {...P} d="M5 7h14" /><path {...P} d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" /><path {...P} d="M6.6 7l.8 12a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3l.8-12" /><path {...P} d="M10.5 11v6M13.5 11v6" /></>,
    edit: <><path {...P} d="M4 20h4l10-10-4-4L4 16v4z" /><path {...P} d="M14.5 5.5l4 4" /></>,
    share: <><path {...P} d="M12 4v11" /><path {...P} d="M8.3 7.7L12 4l3.7 3.7" /><path {...P} d="M5.5 13v5.5a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V13" /></>,
    alert: <><circle {...P} cx="12" cy="12" r="8.5" /><path {...P} d="M12 8v5" /><circle cx="12" cy="16.2" r="1" fill="currentColor" /></>,
    wallet: <><path {...P} d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11a1.5 1.5 0 0 1 1.5 1.5V8" /><rect {...P} x="3.5" y="7.5" width="17" height="11.5" rx="2.5" /><path {...P} d="M20.5 11.5h-3.6a1.9 1.9 0 0 0 0 3.8h3.6" /></>,
    menu: <><path {...P} d="M4 7h16M4 12h16M4 17h16" /></>,
    help: <><path {...P} d="M4 5h16v11H9l-5 4z" /><path {...P} d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4" /><path {...P} d="M12 14.8v.2" /></>,
    shield: <><path {...P} d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path {...P} d="M9 12l2 2 4-4" /></>,
    cutlery: <><path {...P} d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" /><path {...P} d="M17 3c-2 1-3 4-3 7h3v11" /></>,
    teacup: <><path {...P} d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" /><path {...P} d="M16 10h2a2 2 0 0 1 0 4h-2" /><path {...P} d="M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3" /></>,
    cake: <><path {...P} d="M4 20h16v-6H4z" /><path {...P} d="M5 14c0-2 3-3 7-3s7 1 7 3" /><path {...P} d="M12 7v4M12 7c-1-1-1-2 0-3 1 1 1 2 0 3z" /></>,
    burger: <><path {...P} d="M4 11a8 6 0 0 1 16 0z" /><path {...P} d="M3 14.5h18" /><path {...P} d="M5 17v.5a2.5 2.5 0 0 0 2.5 2.5h9a2.5 2.5 0 0 0 2.5-2.5V17z" /></>,
    pot: <><path {...P} d="M5 11h14v5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" /><path {...P} d="M3 11h18" /><path {...P} d="M9 7c0-1 1-1 1-2M14 7c0-1 1-1 1-2" /></>,
    tiffin: <><path {...P} d="M12 3v2" /><rect {...P} x="6" y="5" width="12" height="4" rx="1.5" /><rect {...P} x="6" y="10" width="12" height="4" rx="1.5" /><rect {...P} x="6" y="15" width="12" height="4" rx="1.5" /></>,
    cloche: <><path {...P} d="M3 18h18" /><path {...P} d="M5 18a7 7 0 0 1 14 0" /><path {...P} d="M12 11V9" /><circle {...P} cx="12" cy="8" r="1" /></>,
    bed: <><path {...P} d="M3 19v-9M3 15h18v4M21 15v-2.5A2.5 2.5 0 0 0 18.5 10H11v5" /><circle {...P} cx="7" cy="12" r="1.8" /></>,
    roller: <><rect {...P} x="4" y="3" width="14" height="5" rx="1" /><path {...P} d="M18 5.5h2V11h-9v3" /><rect {...P} x="9.5" y="14" width="3" height="7" rx="1" /></>,
    bag: <><path {...P} d="M6 5h12l1 3-1 12H6L5 8z" /><path {...P} d="M8 11h8M8 15h8" /></>,
    bricks: <><rect {...P} x="3" y="5" width="8" height="5" /><rect {...P} x="13" y="5" width="8" height="5" /><rect {...P} x="8" y="12" width="8" height="5" /></>,
    rods: <><path {...P} d="M4 18L18 4M7 21L21 7M3 14L14 3" /></>,
    pipes: <><path {...P} d="M4 7h9v6h7v4" /><path {...P} d="M4 11h5v6h11" /></>,
    tiles: <><rect {...P} x="4" y="4" width="7" height="7" /><rect {...P} x="13" y="4" width="7" height="7" /><rect {...P} x="4" y="13" width="7" height="7" /><rect {...P} x="13" y="13" width="7" height="7" /></>,
    bolt: <><path {...P} d="M13 3L5 14h6l-1 7 8-11h-6z" /></>,
    tap: <><path {...P} d="M5 10h8a3 3 0 0 0 3-3V5" /><path {...P} d="M5 7v6M3 7h4" /><path {...P} d="M14 14c0 2-1.5 2-1.5 3.5a1.5 1.5 0 0 0 3 0C15.5 16 14 16 14 14z" /></>,
    timber: <><path {...P} d="M3 8h14l4 2v6l-4 2H3z" /><circle {...P} cx="7.5" cy="13" r="2" /></>,
    glass: <><rect {...P} x="5" y="3" width="14" height="18" rx="1" /><path {...P} d="M9 14l6-7M9 18l6-7" /></>,
    sheets: <><path {...P} d="M3 15L8 6h13l-5 9z" /><path {...P} d="M11 6L6 15M16 6l-5 9" /></>,
    scissors: <><circle {...P} cx="6" cy="6" r="2.6" /><circle {...P} cx="6" cy="18" r="2.6" /><path {...P} d="M8.2 7.6L20 17M8.2 16.4L20 7" /></>,
    broom: <><path {...P} d="M14 3l3 6" /><path {...P} d="M5 21l2-8 9-4 2 4-8 6z" /><path {...P} d="M8 17l3 2" /></>,
    leaf: <><path {...P} d="M5 19C5 10 10 5 20 4c0 10-5 15-13 15" /><path {...P} d="M5 19c3-4 6-7 10-9" /></>,
    hammer: <><path {...P} d="M14 5l5 5-3 3-5-5z" /><path {...P} d="M13 9L4 18l2 2 9-9" /></>,
    shirt: <><path {...P} d="M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 0 1-8 0z" /></>,
    bug: <><ellipse {...P} cx="12" cy="14" rx="4" ry="5" /><path {...P} d="M12 9V6M9 5l1.5 2M15 5l-1.5 2M3 12h5M16 12h5M4 19l4-3M20 19l-4-3" /></>,
    snow: <><path {...P} d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" /><path {...P} d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2" /></>,
    laptop: <><rect {...P} x="5" y="5" width="14" height="10" rx="1" /><path {...P} d="M3 19h18" /></>,
    sun: <><circle {...P} cx="12" cy="12" r="4" /><path {...P} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
    music: <><path {...P} d="M9 18V6l10-2v12" /><circle {...P} cx="7" cy="18" r="2" /><circle {...P} cx="17" cy="16" r="2" /></>,
    heart: <><path {...P} d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></>,
    sparkle: <><path {...P} d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></>,
    drop: <><path {...P} d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" /></>,
    bike: <><circle {...P} cx="6" cy="16" r="3.5" /><circle {...P} cx="18" cy="16" r="3.5" /><path {...P} d="M6 16l4-8h5l3 8M10 8L9 5H7M14.5 8L12 16" /></>,
    tv: <><rect {...P} x="3" y="5" width="18" height="12" rx="1.5" /><path {...P} d="M8 21h8M12 17v4" /></>,
    sofa: <><path {...P} d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" /><path {...P} d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z" /><path {...P} d="M6 18v2M18 18v2" /></>,
    washer: <><rect {...P} x="4" y="3" width="16" height="18" rx="2" /><circle {...P} cx="12" cy="13" r="4.5" /><path {...P} d="M7 6.5h2" /></>,
    box: <><path {...P} d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path {...P} d="M3 8l9 5 9-5M12 13v8" /></>,
    chev: <><path {...P} d="M7 10l5 5 5-5" /></>,
    user: <><circle {...P} cx="12" cy="8.5" r="3.7" /><path {...P} d="M4.8 20c.7-3.6 3.6-5.6 7.2-5.6s6.5 2 7.2 5.6" /></>,
    crosshair: <><circle {...P} cx="12" cy="12" r="6.5" /><circle {...P} cx="12" cy="12" r="1.8" /><path {...P} d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block", flexShrink: 0, ...style }}>
      {paths[name] || paths.other}
    </svg>
  );
}

// Group -> icon + colour. Colour carries as much meaning as the glyph at a
// glance, and keeps the grid from reading as one grey mass.
export const GROUPS = {
  "Construction":    { icon: "construction", fg: "#B2560D", bg: "#FFF1E3" },
  "Drivers":         { icon: "drivers",      fg: "#0A6BB5", bg: "#E6F1FC" },
  "Home & Domestic": { icon: "home",         fg: "#7A3FB8", bg: "#F2EBFC" },
  "Food":            { icon: "food",         fg: "#B8143C", bg: "#FDE9EE" },
  "Eat & Stay":      { icon: "food",         fg: "#B45309", bg: "#FFF4D6" },
  "Repairs":         { icon: "repairs",      fg: "#0E7C66", bg: "#E4F6F2" },
  "Vehicle":         { icon: "vehicle",      fg: "#3E4C9A", bg: "#ECEEFB" },
  "Events":          { icon: "events",       fg: "#A8410E", bg: "#FDECE3" },
  "Suppliers":       { icon: "suppliers",    fg: "#125E8A", bg: "#E3F1F8" },
  "Other":           { icon: "other",        fg: "#4A5563", bg: "#EFF1F4" },
};
export const groupStyle = (g) => GROUPS[g] || GROUPS.Other;

// The database group names are descriptive; some are too long for a tile at
// 390px. Only the label changes -- filtering still uses the real name.
const SHORT = { "Home & Domestic": "Home", "Eat & Stay": "Eat & Stay" };
// Group names live in the database in English only (unlike the trades, which
// carry name_bn). Rather than a migration for eight strings that are pure
// presentation, they are translated here.
const GROUP_NAMES = {
  bn: { "Eat & Stay": "খাওয়া ও থাকা", "Construction": "নির্মাণ", "Drivers": "ড্রাইভার", "Home & Domestic": "ঘরের কাজ",
        "Food": "রান্না", "Repairs": "মেরামত", "Vehicle": "গাড়ি", "Events": "অনুষ্ঠান",
        "Suppliers": "দোকান", "Other": "অন্যান্য" },
  hi: { "Eat & Stay": "खाना और ठहराव", "Construction": "निर्माण", "Drivers": "ड्राइवर", "Home & Domestic": "घर का काम",
        "Food": "खाना", "Repairs": "मरम्मत", "Vehicle": "गाड़ी", "Events": "आयोजन",
        "Suppliers": "दुकान", "Other": "अन्य" },
  mr: { "Eat & Stay": "खाणे आणि राहणे", "Construction": "बांधकाम", "Drivers": "ड्रायव्हर", "Home & Domestic": "घरकाम",
        "Food": "जेवण", "Repairs": "दुरुस्ती", "Vehicle": "गाडी", "Events": "कार्यक्रम",
        "Suppliers": "दुकान", "Other": "इतर" },
  te: { "Eat & Stay": "భోజనం & బస", "Construction": "నిర్మాణం", "Drivers": "డ్రైవర్లు", "Home & Domestic": "ఇంటి పని",
        "Food": "వంట", "Repairs": "రిపేర్లు", "Vehicle": "వాహనం", "Events": "ఫంక్షన్లు",
        "Suppliers": "దుకాణాలు", "Other": "ఇతర" },
  ta: { "Eat & Stay": "உணவு & தங்குமிடம்", "Construction": "கட்டுமானம்", "Drivers": "டிரைவர்", "Home & Domestic": "வீட்டு வேலை",
        "Food": "சமையல்", "Repairs": "பழுது", "Vehicle": "வாகனம்", "Events": "நிகழ்ச்சி",
        "Suppliers": "கடைகள்", "Other": "மற்றவை" },
  gu: { "Eat & Stay": "ખાવું અને રહેવું", "Construction": "બાંધકામ", "Drivers": "ડ્રાઇવર", "Home & Domestic": "ઘરકામ",
        "Food": "રસોઈ", "Repairs": "રિપેર", "Vehicle": "વાહન", "Events": "પ્રસંગ",
        "Suppliers": "દુકાન", "Other": "અન્ય" },
  kn: { "Eat & Stay": "ಊಟ ಮತ್ತು ವಾಸ", "Construction": "ಕಟ್ಟಡ ಕೆಲಸ", "Drivers": "ಡ್ರೈವರ್", "Home & Domestic": "ಮನೆಗೆಲಸ",
        "Food": "ಅಡುಗೆ", "Repairs": "ರಿಪೇರಿ", "Vehicle": "ವಾಹನ", "Events": "ಸಮಾರಂಭ",
        "Suppliers": "ಅಂಗಡಿ", "Other": "ಇತರೆ" },
  ml: { "Eat & Stay": "ഭക്ഷണവും താമസവും", "Construction": "നിർമ്മാണം", "Drivers": "ഡ്രൈവർ", "Home & Domestic": "വീട്ടുജോലി",
        "Food": "പാചകം", "Repairs": "റിപ്പയർ", "Vehicle": "വാഹനം", "Events": "പരിപാടികൾ",
        "Suppliers": "കടകൾ", "Other": "മറ്റുള്ളവ" },
  or: { "Eat & Stay": "ଖାଇବା ଓ ରହିବା", "Construction": "ନିର୍ମାଣ", "Drivers": "ଡ୍ରାଇଭର", "Home & Domestic": "ଘର କାମ",
        "Food": "ରୋଷେଇ", "Repairs": "ମରାମତି", "Vehicle": "ଗାଡ଼ି", "Events": "ଉତ୍ସବ",
        "Suppliers": "ଦୋକାନ", "Other": "ଅନ୍ୟାନ୍ୟ" },
  pa: { "Eat & Stay": "ਖਾਣਾ ਤੇ ਠਹਿਰ", "Construction": "ਉਸਾਰੀ", "Drivers": "ਡਰਾਈਵਰ", "Home & Domestic": "ਘਰ ਦਾ ਕੰਮ",
        "Food": "ਖਾਣਾ", "Repairs": "ਮੁਰੰਮਤ", "Vehicle": "ਗੱਡੀ", "Events": "ਸਮਾਗਮ",
        "Suppliers": "ਦੁਕਾਨ", "Other": "ਹੋਰ" },
  as: { "Eat & Stay": "খোৱা আৰু থকা", "Construction": "নিৰ্মাণ", "Drivers": "ড্ৰাইভাৰ", "Home & Domestic": "ঘৰুৱা কাম",
        "Food": "ৰন্ধন", "Repairs": "মেৰামতি", "Vehicle": "গাড়ী", "Events": "অনুষ্ঠান",
        "Suppliers": "দোকান", "Other": "অন্যান্য" },
};
export const groupLabel = (g, lang) =>
  (GROUP_NAMES[lang] && GROUP_NAMES[lang][g]) || SHORT[g] || g;

// ---------------------------------------------------------------- dismissing
//
// Every sheet in this app can be closed three ways, and they all end in the
// same place:
//
//   * the X in its corner
//   * Escape, on a keyboard
//   * the ANDROID BACK BUTTON, which is the one that mattered most and was
//     missing entirely. Most people here are on Android, and Back is the
//     gesture they use without thinking. Because nothing pushed a history
//     entry when a sheet opened, pressing it left the app instead of closing
//     the sheet -- and a person who has just been thrown out of an app does
//     not usually come back in to find out why.
//
// Opening a sheet pushes one history entry; Back pops it and closes the
// sheet. Closing by the X or the backdrop pops that entry too, so the
// history is left exactly as it was found and one Back press never does
// nothing.
// ---------------------------------------------------------------------------
// Sheets can stack (a question over the location sheet, the map over a sheet),
// so only the TOP one answers Back and Escape, and the history step a closing
// sheet takes back is not mistaken for a Back press by the sheet underneath.
const openSheets = [];
let ignorePopUntil = 0;

export function useDismissable(open, onClose) {
  // Held in a ref so that a parent re-rendering with a new inline onClose
  // does not re-run this effect and push a second history entry.
  const cb = React.useRef(onClose);
  React.useEffect(() => { cb.current = onClose; }, [onClose]);

  React.useEffect(() => {
    if (!open) return undefined;
    let byBack = false;
    const token = {};
    openSheets.push(token);
    const isTop = () => openSheets[openSheets.length - 1] === token;

    const onKey = (e) => { if (e.key === "Escape" && isTop()) cb.current(); };
    const onPop = () => {
      if (Date.now() < ignorePopUntil || !isTop()) return;
      byBack = true;
      cb.current();
    };

    try { window.history.pushState({ dhundoSheet: true }, ""); } catch (_) {}
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      const i = openSheets.indexOf(token);
      if (i >= 0) openSheets.splice(i, 1);
      if (!byBack) {
        try {
          if (window.history.state && window.history.state.dhundoSheet) {
            ignorePopUntil = Date.now() + 350;
            window.history.back();
          }
        } catch (_) {}
      }
    };
  }, [open]);
}

// The X that closes a sheet. One component so every sheet's is the same size,
// in the same corner, with the same 44px tap target -- three of them had
// drifted to different paddings.
export function CloseButton({ onClick, label = "Close", tone = "dark" }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 44, height: 44, flexShrink: 0, marginRight: -8,
      background: "none", border: "none", cursor: "pointer",
      color: tone === "light" ? "rgba(255,255,255,0.9)" : T.inkFaint,
    }}><Icon name="close" size={21} /></button>
  );
}

// ------------------------------------------------------------------ controls
export const input = {
  width: "100%", padding: "12px 13px", borderRadius: 10,
  border: `1px solid ${T.line}`, fontSize: 15, color: T.ink,
  background: T.white, outline: "none", boxSizing: "border-box", minHeight: 46,
  fontFamily: "inherit",
};

export function Btn({ children, onClick, disabled, kind = "primary", full, style }) {
  const kinds = {
    primary: { background: T.brand, color: "#fff", border: "none" },
    dark:    { background: T.brandDeep, color: "#fff", border: "none" },
    ghost:   { background: T.white, color: T.ink, border: `1px solid ${T.line}` },
    call:    { background: T.green, color: "#fff", border: "none" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: "12px 18px", borderRadius: 10, fontSize: 14.5, fontWeight: 700,
        cursor: disabled ? "default" : "pointer", minHeight: 46,
        width: full ? "100%" : undefined, opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit", ...kinds[kind], ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 14px", borderRadius: 22, fontSize: 13.5, fontWeight: 600,
        cursor: "pointer", minHeight: 40, fontFamily: "inherit", whiteSpace: "nowrap",
        border: `1px solid ${active ? T.brandDark : T.line}`,
        background: active ? T.brandDark : T.white,
        color: active ? "#fff" : T.ink,
      }}
    >
      {children}
    </button>
  );
}

// The small red "Required" next to a label, used wherever the vehicle number
// or the ID photo is asked for, so the same thing looks the same everywhere.
export function ReqTag() {
  const { t } = useI18n();
  return (
    <span style={{
      display: "inline-block", marginLeft: 7, fontSize: 11, fontWeight: 800, color: T.red,
      background: T.redSoft, border: `1px solid ${T.red}`, borderRadius: 10, padding: "1px 7px",
      verticalAlign: "middle", whiteSpace: "nowrap",
    }}>{t("req_tag")}</span>
  );
}

export function Notice({ tone = "info", children }) {
  const t = {
    info: { bg: T.brandSoft, bd: "rgba(0,119,163,0.25)", fg: T.brandDeep },
    good: { bg: T.greenSoft, bd: "rgba(18,128,74,0.28)", fg: T.green },
    bad:  { bg: T.redSoft,   bd: "rgba(196,61,46,0.30)", fg: T.red },
  }[tone];
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, borderRadius: 10,
      padding: "11px 13px", fontSize: 13.5, lineHeight: 1.55, marginBottom: 14,
    }}>{children}</div>
  );
}

// ------------------------------------------------------------------ language
function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  // A dropdown now: twelve languages do not fit in a header as buttons. The
  // closed box shows the current language's short name in its own script;
  // the open list shows every language in ITS own script, so somebody who
  // cannot read the current one can still find theirs.
  const cur = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <label style={{
      position: "relative", display: "inline-flex", alignItems: "center", gap: 4,
      background: T.paper, border: `1px solid ${T.line}`, borderRadius: 22,
      padding: "0 10px", minHeight: 36, cursor: "pointer",
      color: T.brandDark, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <span aria-hidden="true">{cur.short}</span>
      <Icon name="chev" size={13} style={{ color: T.inkFaint }} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label="Language / भाषा / ভাষা"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          opacity: 0, cursor: "pointer", fontSize: 16,
        }}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}{l.code !== "en" ? ` (${LANGS_EN[l.code]})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

// English names beside the native ones in the list, for the admin or helper
// setting a phone up for somebody else.
const LANGS_EN = {
  hi: "Hindi", bn: "Bengali", mr: "Marathi", te: "Telugu", ta: "Tamil",
  gu: "Gujarati", kn: "Kannada", ml: "Malayalam", or: "Odia", pa: "Punjabi",
  as: "Assamese",
};

// ------------------------------------------------------------------- install
export function InstallButton({ onOpen }) {
  const { isIos, installed } = useInstallPrompt();
  const { t } = useI18n();
  // Shown to everybody on Android who does not already have it.
  //
  // This used to be hidden unless Chrome had fired beforeinstallprompt --
  // which meant that on every browser that never fires it (Firefox, a
  // stripped-down Chromium on a cheap phone, a webview) there was no way to
  // reach the APK at all. That was defensible while add-to-home-screen was
  // the only thing behind this button. It is not, now that a downloadable
  // file is: the sheet always has something to offer, on Android an APK and
  // on iOS instructions, so the button should always be there to open it.
  // iOS cannot install an APK, and add-to-home-screen was removed, so there
  // is nothing behind this button on an iPhone. Hiding it beats opening an
  // empty sheet. iPhone users still have the site itself, which works.
  if (installed || isIos) return null;
  return (
    <button
      onClick={onOpen}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: T.brandSoft, border: `1px solid rgba(0,119,163,0.25)`,
        borderRadius: 22, padding: "8px 13px", fontSize: 13, fontWeight: 700,
        color: T.brandDeep, cursor: "pointer", minHeight: 40,
        whiteSpace: "nowrap", fontFamily: "inherit",
      }}
    >
      <Icon name="download" size={15} />
      {t("install_app")}
    </button>
  );
}

// On the front screen: one clear bar to get the app. Not inside the app
// itself, not once it is installed, and not on an iPhone, which cannot
// install the APK.
// "CAN'T SIGN UP? WHATSAPP US."
//
// A phone number and a six-digit PIN is simple for most people and a wall
// for some: a first smartphone, a mistri who has never filled a form, an
// elderly customer. For them the way in is a person, so the sign-up help
// number is shown before sign-up, with the message already written in their
// language. Hidden when CONTACT.whatsapp is empty.
export function SignupHelp({ style }) {
  const { t } = useI18n();
  if (!CONTACT.whatsapp) return null;
  const num = CONTACT.whatsapp.replace(/\D/g, "");
  const shown = num.length === 12 && num.startsWith("91")
    ? `+91 ${num.slice(2, 7)} ${num.slice(7)}` : `+${num}`;
  const href = `https://wa.me/${num}?text=${encodeURIComponent(t("sh_msg"))}`;
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 14px",
      borderRadius: 14, background: "#EAF8EF", border: "1px solid rgba(37,211,102,0.45)",
      marginBottom: 16, textAlign: "left", ...style,
    }}>
      <span aria-hidden="true" style={{
        width: 40, height: 40, borderRadius: "50%", background: "#25D366", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.8-4.2-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.1z"/>
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: "#0F1419", lineHeight: 1.35 }}>
          {t("sh_title")}
        </span>
        <span style={{ display: "block", fontSize: 13.5, color: "#3D4A55", lineHeight: 1.55, margin: "4px 0 6px" }}>
          {t("sh_body")}
        </span>
        <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: "#0F1419",
                       letterSpacing: 0.3, margin: "0 0 10px", whiteSpace: "nowrap" }}>
          {shown}
        </span>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-flex", alignItems: "center", gap: 8, background: "#25D366",
          color: "#fff", padding: "10px 18px", borderRadius: 22, fontWeight: 800,
          fontSize: 14.5, textDecoration: "none", minHeight: 44, boxSizing: "border-box",
        }}>
          {t("sh_btn")}
        </a>
      </span>
    </div>
  );
}

export function InstallBanner({ onOpen }) {
  const { isIos, installed } = useInstallPrompt();
  const { t } = useI18n();
  if (installed || isIos || isInstalledApp()) return null;
  return (
    <button onClick={onOpen} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 12, marginBottom: 18,
      padding: "12px 14px", borderRadius: 16, cursor: "pointer", textAlign: "left",
      background: "linear-gradient(90deg, #054291, #0A5BC4)", border: "none",
      color: "#fff", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(5,66,145,0.25)",
    }}>
      <span style={{
        width: 44, height: 44, borderRadius: 12, background: "#fff", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><img src="/logo-mark.png" alt="" width="34" height="34" /></span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>
        {t("install_banner")}
      </span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, background: "#fff",
        color: "#054291", borderRadius: 22, padding: "9px 14px", fontSize: 14,
        fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0,
      }}>
        <Icon name="download" size={16} /> {t("install_short")}
      </span>
    </button>
  );
}

// ------------------------------------------------------- vehicle numbers
//
// These two mirror services_normalize_plate() and services_valid_plate() in
// 67 EXACTLY. They are a courtesy -- telling somebody about a typo while
// they are still looking at the field rather than after a round trip -- and
// the database remains the authority: it re-normalises and re-checks what
// arrives, and a CHECK constraint refuses anything malformed whatever the
// browser believed.
//
// Kept deliberately lenient, for the reason given in 67: India has the
// standard series, the BH series and a long tail of legitimate plates that
// match no tidy pattern. Rejecting a real plate is worse than accepting an
// odd one that an admin will see anyway.
export const normalizePlate = (s) =>
  String(s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export const plateLooksRight = (s) => {
  const p = normalizePlate(s);
  if (!p) return false;
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4}$/.test(p)
      || /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(p);
};

// ----------------------------------------------------------- ConfirmDelete
//
// A second, deliberate tap before anything is destroyed.
//
// Not a browser confirm(): those are blocked in some webviews, unstyled, and
// in English regardless of what language the person is reading. And not a
// single red button either -- this is the one action in the app with no undo
// and it deletes a photograph of somebody's face, so it is worth the extra
// tap.
//
// The dangerous button is on the RIGHT and the safe one on the left, and
// "Cancel" is the visually heavier of the two. Somebody dismissing a sheet
// by muscle memory should hit the harmless one.
export function ConfirmDelete({ title, body, confirmLabel, busy, extra, onCancel, onConfirm }) {
  const { t } = useI18n();
  useDismissable(true, busy ? () => {} : onCancel);
  return (
    <div role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,20,25,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
      }}>
      <div style={{
        background: T.white, borderRadius: 16, width: "100%", maxWidth: 400,
        padding: "20px 18px 18px", boxShadow: "0 12px 44px rgba(0,30,45,0.3)",
      }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <span style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: T.redSoft, color: T.red,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Icon name="alert" size={22} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 16.5, fontWeight: 800, color: T.ink }}>
              {title}
            </span>
            <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft,
                           lineHeight: 1.6, marginTop: 5 }}>
              {body}
            </span>
          </span>
        </div>
        {/* An extra choice the caller wants made at the same moment -- such
            as whether a deletion also bars the number. Above the buttons so
            it is read before the decision, not after. */}
        {extra}

        <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
          <Btn kind="ghost" full disabled={busy} onClick={onCancel}>{t("cancel")}</Btn>
          <Btn full disabled={busy} onClick={onConfirm}
               style={{ background: T.red, color: "#fff", border: "none" }}>
            {busy ? t("w_sending") : (confirmLabel || t("del_confirm"))}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ money
//
// The database stores paise as an integer, and this is the ONLY place that
// turns one into something a person reads. ₹5 is 500 paise; a balance is
// never a float anywhere in this app, because a rupee that arrives as
// 4.999999999999999 is a support conversation nobody wants to have.
//
// Whole rupees lose the decimals -- "₹5", not "₹5.00" -- because that is how
// the amount is spoken. Anything with paise in it keeps both digits.
export function rupees(paise) {
  const n = Number(paise || 0);
  const whole = Math.trunc(n / 100);
  const rem = Math.abs(n % 100);
  const body = rem === 0
    ? whole.toLocaleString("en-IN")
    : `${whole.toLocaleString("en-IN")}.${String(rem).padStart(2, "0")}`;
  return `₹${body}`;
}

// ----------------------------------------------------------------- wallet
//
// WHAT THIS DELIBERATELY DOES NOT HAVE: a withdraw button, a send button, or
// anything that implies the balance can leave. It cannot, yet. Showing a
// disabled "Withdraw" would be worse than showing nothing -- it promises a
// thing that does not exist and invites somebody to sign up expecting cash.
// The copy says plainly that it is saved for later.
// ------------------------------------------------------------- invitations
//
// The code is the thing people actually pass on -- read down a phone line,
// written on a receipt -- so it is set in large, wide-spaced type, and the
// link is the convenience rather than the other way round. Native sharing
// where the phone offers it, clipboard where it does not, and the code
// visible either way for the person who will just say it out loud.
//
// The counts are deliberately two numbers, not one: somebody with nine
// invited and nothing earned should be able to see that the money waits for
// their friends to be published, rather than concluding the app is broken.
export function InvitePanel({ api }) {
  const { t } = useI18n();
  const [r, setR] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    api.myReferrals()
      .then((x) => { if (alive) setR(Array.isArray(x) ? x[0] || null : x || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [api]);

  if (!r || !r.code) return null;
  const link = `${window.location.origin}/?ref=${encodeURIComponent(r.code)}`;
  const message = t("inv_message").replace("{link}", link);

  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ text: message }); return; }
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (_) {
      // The person cancelled the share sheet, or the clipboard is blocked.
      // The code is on screen either way, which is the part that matters.
    }
  };

  return (
    <div style={{
      marginTop: 14, padding: "15px 14px", borderRadius: 14,
      border: `1px solid ${T.line}`, background: T.paper,
    }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
        {t("inv_title")}
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6, marginBottom: 12 }}>
        {t("inv_body")}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: T.white, border: `1.5px dashed ${T.brandDark}`, borderRadius: 12,
        padding: "14px 10px", marginBottom: 10,
      }}>
        <span style={{
          fontSize: 27, fontWeight: 800, letterSpacing: 5, color: T.brandDeep,
          fontVariantLigatures: "none",
        }}>{r.code}</span>
      </div>

      <Btn full kind="ghost" onClick={share}>
        <Icon name="share" size={17} /> {copied ? t("inv_copied") : t("inv_share")}
      </Btn>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {[[t("inv_invited"), r.invited], [t("inv_published"), r.published]].map(([label, n]) => (
          <div key={label} style={{
            flex: 1, background: T.white, border: `1px solid ${T.line}`,
            borderRadius: 11, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>{Number(n) || 0}</div>
            <div style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 700, marginTop: 1 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Said plainly, because the gap between inviting and being paid is
          where people decide the app cheated them. */}
      <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.55, marginTop: 10 }}>
        {t("inv_when")}
      </div>
    </div>
  );
}

const WD_MIN = 50000; // paise: Rs 500, the same figure sql/103 enforces

export function WalletSheet({ api, phone, onClose, PhoneVerify = null }) {
  const { t, lang } = useI18n();
  useDismissable(true, onClose);
  const [state, setState] = React.useState({ loading: true, paise: 0, rows: [], failed: false });
  const [withdraw, setWithdraw] = React.useState(false);
  const [wd, setWd] = React.useState({ upi: "", busy: false, err: "", sent: false });
  const [open, setOpen] = React.useState([]);
  const [reload, setReload] = React.useState(0);
  const [verified, setVerified] = React.useState(true);
  const [pvOpen, setPvOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    Promise.resolve(api.myWithdrawals ? api.myWithdrawals() : [])
      .then((w) => { if (alive) setOpen((Array.isArray(w) ? w : []).filter((x) => x.status === "requested")); })
      .catch(() => {});
    Promise.resolve(api.phoneVerified ? api.phoneVerified() : true)
      .then((v) => { if (alive) setVerified(v !== false && !(Array.isArray(v) && v[0] === false)); })
      .catch(() => {});
    Promise.all([api.walletBalance(), api.walletHistory(50)])
      .then(([b, h]) => {
        if (!alive) return;
        const paise = Array.isArray(b) ? Number(b[0] || 0) : Number(b || 0);
        setState({ loading: false, paise, rows: Array.isArray(h) ? h : h ? [h] : [], failed: false });
      })
      .catch(() => { if (alive) setState({ loading: false, paise: 0, rows: [], failed: true }); });
    return () => { alive = false; };
  }, [api, reload]);

  const sendWithdraw = async () => {
    setWd((x) => ({ ...x, busy: true, err: "" }));
    try {
      const r = await api.withdraw(wd.upi.trim());
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.ok) {
        setWd({ upi: "", busy: false, err: "", sent: true });
        setWithdraw(false);
        setReload((n) => n + 1);
      } else {
        const k = x && x.reason;
        setWd((y) => ({ ...y, busy: false, err: k === "phone_not_verified" ? t("pv_banner") : k === "bad_upi" ? t("wal_wd_bad_upi") : k === "below_minimum" ? t("wal_wd_min").replace("{min}", rupees(WD_MIN)).replace("{need}", "") : k === "already_open" ? t("wal_wd_pending").replace("{a}", "").replace("{u}", "") : t("e_gone") }));
      }
    } catch (e) {
      setWd((y) => ({ ...y, busy: false, err: (e && e.message) || t("e_gone") }));
    }
  };

  const when = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(
        lang === "bn" ? "bn-IN" : lang === "hi" ? "hi-IN" : "en-IN",
        { day: "numeric", month: "short", year: "numeric" }
      );
    } catch (_) { return ""; }
  };

  const label = (row) =>
    row.kind === "signup_bonus" ? t("wal_kind_bonus")
      : row.kind === "listing_bonus" ? t("wal_kind_listing")
      : row.kind === "promo" ? t("wal_kind_promo")
      : row.kind === "refund" ? t("wal_kind_refund")
      : row.kind === "referral" ? t("wal_kind_referral")
      : row.kind === "withdrawal" ? t("wal_kind_withdrawal")
      : t("wal_kind_adjustment");

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,20,25,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div style={{
        background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460,
        padding: "20px 20px 26px", boxShadow: "0 -10px 40px rgba(0,30,45,0.25)",
        maxHeight: "86vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: T.ink, flex: 1 }}>
            {t("wal_title")}
          </span>
          <CloseButton onClick={onClose} />
        </div>

        {/* The balance, large. This is the one number the screen is for. */}
        <div style={{
          background: `linear-gradient(135deg, ${T.brand}, ${T.brandDeep})`,
          borderRadius: 16, padding: "20px 18px", color: "#fff", marginBottom: 16,
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.85,
                        textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("wal_balance")}
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.15, marginTop: 4 }}>
            {state.loading ? "—" : rupees(state.paise)}
          </div>
        </div>

        {state.failed && <Notice tone="bad">{t("wal_failed")}</Notice>}

        {/* Said before the history, not after: somebody who sees ₹5 and a
            list of credits will ask "can I take this out" within seconds,
            and the answer should reach them before the question does. */}
        {!verified && (
          <div style={{ marginBottom: 12, border: `1.5px solid ${T.red}`, background: T.redSoft, borderRadius: 14, padding: "13px 14px" }}>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, marginBottom: 9 }}>{t("pv_banner")}</div>
            <Btn full onClick={() => setPvOpen(true)}>{t("pv_title")}</Btn>
          </div>
        )}
        {pvOpen && PhoneVerify && (
          <PhoneVerify api={api} phone={phone} onClose={() => setPvOpen(false)}
                       onDone={() => { setPvOpen(false); setVerified(true); setReload((n) => n + 1); }} />
        )}
        <Notice tone="info">{t("wal_not_spendable")}</Notice>

        {/* Below the balance and its caveat, above withdraw: this is the one
            thing on the screen a person can act on today. */}
        <InvitePanel api={api} />

        {/* ------------------------------------------------------ withdraw
            A STUB. The layout is final so that switching it on later is a
            change to sendWithdrawOtp() and nothing else, but it does not
            pretend to have sent anything: claiming "code sent to your
            number" when no SMS provider is connected leaves somebody
            waiting for a message that cannot arrive, retrying, and
            eventually deciding the app took their ₹5. The button is live,
            the answer is honest, and the fields below show what the real
            flow will look like.

            TO SWITCH THIS ON, three things, in this order:
              1. An SMS provider and a DLT template registration (India
                 requires the template to be pre-registered before any
                 transactional SMS is delivered).
              2. A services_withdraw_request() function that checks the
                 code, and only then writes a NEGATIVE ledger row. Money
                 leaves by a row being written, never by a balance edit.
              3. The RBI prepaid-payment-instrument question, which is the
                 real gate: value a user can take out as cash is a
                 different regulated thing from credit spent in-app.
            Until 2 exists there is no debit path anywhere in the database,
            which is what makes this button safe to show. */}
        <div style={{ marginTop: 14 }}>
          {state.loading ? null : state.paise < WD_MIN ? (
            <Notice tone="info">
              {t("wal_wd_min").replace("{min}", rupees(WD_MIN)).replace("{need}", rupees(WD_MIN - state.paise))}
            </Notice>
          ) : !withdraw ? (
            <Btn full onClick={() => setWithdraw(true)}>{t("wal_withdraw")}</Btn>
          ) : (
            <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: "15px 14px" }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
                {t("wal_wd_title")} · {rupees(state.paise)}
              </div>
              <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>
                {t("wal_wd_body")}
              </div>
              <input
                style={{ ...input, marginBottom: 10 }} value={wd.upi} autoCapitalize="none" autoCorrect="off"
                onChange={(e) => setWd((x) => ({ ...x, upi: e.target.value, err: "" }))}
                placeholder={t("wal_wd_upi_ph")} aria-label={t("wal_wd_upi_ph")} maxLength={70}
              />
              {wd.err && <Notice tone="bad">{wd.err}</Notice>}
              <Btn full disabled={wd.busy || wd.upi.trim().length < 5} onClick={sendWithdraw}>
                {wd.busy ? "…" : t("wal_wd_req").replace("{a}", rupees(state.paise))}
              </Btn>
              <button onClick={() => setWithdraw(false)} style={{
                background: "none", border: "none", cursor: "pointer", color: T.brandDark,
                fontWeight: 700, fontSize: 13.5, minHeight: 44, fontFamily: "inherit",
                padding: 0, marginTop: 4,
              }}>{t("w_back")}</button>
            </div>
          )}
          {wd.sent && <div style={{ marginTop: 10 }}><Notice tone="info">{t("wal_wd_sent")}</Notice></div>}
          {open.map((w) => (
            <div key={w.id} style={{ marginTop: 10 }}>
              <Notice tone="info">
                {t("wal_wd_pending").replace("{a}", rupees(w.amount_paise)).replace("{u}", w.upi_id)}
              </Notice>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.inkSoft,
                      margin: "18px 0 8px" }}>
          {t("wal_history")}
        </div>

        {state.loading ? (
          <div style={{ fontSize: 14, color: T.inkFaint, padding: "10px 2px" }}>
            {t("wal_loading")}
          </div>
        ) : state.rows.length === 0 ? (
          <div style={{ fontSize: 14, color: T.inkFaint, padding: "10px 2px", lineHeight: 1.6 }}>
            {t("wal_empty")}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 2 }}>
            {state.rows.map((row) => (
              <div key={row.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 2px", borderBottom: `1px solid ${T.line}`,
              }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: T.brandSoft, color: T.brandDark,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Icon name="wallet" size={17} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: T.ink }}>
                    {label(row)}
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: T.inkFaint, marginTop: 2 }}>
                    {when(row.created_at)}
                  </span>
                </span>
                {/* A credit is green with a +; a debit would be plain ink.
                    There are no debits yet, and this is ready for the day
                    there are rather than assuming there never will be. */}
                <span style={{
                  fontSize: 15.5, fontWeight: 800, whiteSpace: "nowrap",
                  color: Number(row.amount_paise) >= 0 ? "#0B7A3B" : T.ink,
                }}>
                  {Number(row.amount_paise) >= 0 ? "+" : "−"}
                  {rupees(Math.abs(Number(row.amount_paise)))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function InstallSheet({ onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,20,25,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0,
      }}
    >
      <div style={{
        background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460,
        padding: "22px 20px 26px", boxShadow: "0 -10px 40px rgba(0,30,45,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 14 }}>
          <span style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: `linear-gradient(135deg, ${T.brand}, ${T.brandDeep})`, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="pin" size={24} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: T.ink }}>
              {t("install_title")}
            </span>
            <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, marginTop: 4 }}>
              {t("install_body")}
            </span>
          </span>
          <CloseButton onClick={onClose} />
        </div>

        {/* APK ONLY.
            Add-to-home-screen was removed deliberately. It installed nothing,
            downloaded nothing and showed no progress -- an icon simply
            appeared -- and people reported that as a broken button. For this
            audience "installing an app" means a file, a download and an
            "unknown source" warning, and offering a second path that defies
            that only made the first one look untrustworthy.

            There is no APK for iOS, so InstallButton hides itself there
            rather than opening a sheet with nothing in it. */}
        <a
          href="/dhundo.apk"
          download="Dhundo.apk"
          onClick={() => setTimeout(onClose, 800)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: "14px", borderRadius: 11,
            minHeight: 52, boxSizing: "border-box", textDecoration: "none",
            border: "none", background: T.brand, color: "#fff",
            fontSize: 15, fontWeight: 700,
          }}
        >
          <Icon name="download" size={18} />
          {t("install_apk")}
        </a>
        <p style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.5,
                    margin: "10px 2px 0", textAlign: "center" }}>
          {t("install_apk_note")}
        </p>

        <button onClick={onClose} style={{
          width: "100%", marginTop: 10, padding: 11, borderRadius: 10, background: "none",
          border: "none", color: T.inkFaint, fontSize: 13.5, cursor: "pointer",
          minHeight: 44, fontFamily: "inherit",
        }}>{t("later")}</button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- state
// A native dropdown rather than a row of buttons: thirty-six states and
// union territories do not fit as buttons, and a phone's own picker is the
// easiest long list to scroll with a thumb.
export function StateSelect({ value, onChange, dark = false, big = false, style }) {
  const { lang } = useI18n();
  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", ...style }}>
      <select
        value={STATES.includes(value) ? value : ""}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{
          appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
          width: "100%", maxWidth: "100%", fontFamily: "inherit",
          fontSize: big ? 15.5 : 16, fontWeight: 700, cursor: "pointer",
          padding: big ? "13px 40px 13px 14px" : "7px 34px 7px 13px",
          minHeight: big ? 52 : 36, borderRadius: big ? 11 : 20,
          border: dark ? "1px solid rgba(255,255,255,0.55)" : `1.5px solid ${T.brandDark}`,
          background: dark ? "transparent" : (big ? T.brandSoft : T.white),
          color: dark ? "#fff" : T.brandDeep,
        }}
      >
        {!STATES.includes(value) && <option value="">—</option>}
        {STATES.map((st) => (
          <option key={st} value={st} style={{ color: T.ink }}>
            {stateName(st, lang)}{lang !== "en" && stateName(st, lang) !== st ? ` (${st})` : ""}
          </option>
        ))}
      </select>
      <Icon name="chev" size={15} style={{
        position: "absolute", right: big ? 14 : 12, top: "50%",
        transform: "translateY(-50%)", pointerEvents: "none",
        color: dark ? "#fff" : T.brandDark,
      }} />
    </div>
  );
}

export function StateSwitch({ value, onChange, dark }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{
        fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
        color: dark ? "rgba(255,255,255,0.7)" : T.inkFaint, textTransform: "uppercase",
      }}>{t("state_label")}</span>
      <StateSelect value={value} onChange={onChange} dark={dark} />
    </div>
  );
}

// -------------------------------------------------------------- area picker
//
// A list, not a text box. Free text meant "panisagar", "Panisagar" and
// "Panisagar, North Tripura" were three different places, so the locality
// filter -- the single most important filter in a LOCAL directory -- matched
// two listings out of three and looked broken.
//
// Typing still works, but it SEARCHES rather than records: every keystroke
// filters the list, and the value is only ever set by choosing a row. The
// one escape hatch is deliberate: a place that is genuinely missing can be
// used as typed, from a row that says so in as many words. Somebody in a
// village the list forgot must not be locked out by a data file.
export function AreaPicker({ state, value, onPick, autoFocus }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState([]);
  const [looking, setLooking] = useState(false);

  // The local list renders instantly from memory; the geocoder is asked in
  // the background and its results are appended under their own heading. So
  // the control is never waiting on the network to be usable, and on a dead
  // connection it simply behaves as it did before.
  React.useEffect(() => {
    const typed = q.trim();
    if (typed.length < 3) { setRemote([]); setLooking(false); return; }
    const ctrl = new AbortController();
    setLooking(true);
    // 350ms: long enough that typing "panisagar" is one request rather than
    // nine, short enough not to feel like a pause.
    const timer = setTimeout(() => {
      searchRemote(state, typed, ctrl.signal)
        .then((rows) => setRemote(rows))
        .finally(() => setLooking(false));
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); setLooking(false); };
  }, [q, state]);

  const results = searchPlaces(state, q);
  const typed = q.trim();
  // WHEN TYPING YOUR OWN NAME IS OFFERED.
  //
  // It used to need three characters AND for no list anywhere to contain the
  // name. That was built to stop a free-typed duplicate outranking a real
  // row, which was a genuine bug -- but it went too far. Somebody whose para
  // is not in any register types its name, sees a DIFFERENT village that
  // happens to match those letters, and has no way to say "no, mine".
  //
  // Now it is offered from two characters, and suppressed only when what was
  // typed is EXACTLY a name already on screen -- where tapping the row is
  // the same answer and a better one, because it carries coordinates. It
  // still sits below the matches, which is the ordering that mattered.
  const shownNames = [
    ...results.map((r) => r.place),
    ...remote.map((r) => r.place),
  ].map((x) => x.toLowerCase());
  const canUseTyped =
    typed.length >= 2 && !shownNames.includes(typed.toLowerCase());

  const groups = [];
  results.forEach((r) => {
    const last = groups[groups.length - 1];
    if (last && last.group === r.group) last.places.push(r.place);
    else groups.push({ group: r.group, places: [r.place] });
  });

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 9, padding: "0 13px",
        border: `1px solid ${T.line}`, borderRadius: 11, minHeight: 52, marginBottom: 10,
      }}>
        <span style={{ color: T.inkFaint }}><Icon name="search" size={19} /></span>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus}
          placeholder={t("area_search_ph")}
          style={{ ...input, border: "none", padding: "13px 0", background: "transparent",
                   fontSize: 16, minHeight: 0 }}
        />
        {q && (
          <button onClick={() => setQ("")} aria-label={t("p_remove")} style={{
            background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 2,
          }}><Icon name="close" size={17} /></button>
        )}
      </div>

      <div style={{
        maxHeight: 260, overflowY: "auto", border: `1px solid ${T.line}`,
        borderRadius: 11, background: T.white,
      }}>
        {groups.length === 0 && remote.length === 0 && !looking && !canUseTyped && (
          <div style={{ padding: "18px 14px", color: T.inkFaint, fontSize: 14, lineHeight: 1.6 }}>
            {typed ? t("area_none") : t("area_hint")}
          </div>
        )}

        {/* The escape hatch goes LAST. Typing "pani" matched Panisagar, and
            with "use what I typed" sitting above it the obvious tap was the
            wrong one -- a free-text duplicate of a place already in the
            list, which is the exact thing this control exists to prevent. */}
        {groups.map((g) => (
          <div key={g.group}>
            <div style={{
              padding: "9px 14px 6px", fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4,
              color: T.inkFaint, textTransform: "uppercase", background: T.paper,
              position: "sticky", top: 0,
            }}>{g.group}</div>
            {g.places.map((p) => {
              const on = p === value;
              return (
                <button key={p} onClick={() => onPick(p, { group: g.group })} style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%",
                  padding: "12px 14px", minHeight: 48, cursor: "pointer", textAlign: "left",
                  border: "none", borderBottom: `1px solid ${T.line}`,
                  background: on ? T.brandSoft : T.white,
                  color: on ? T.brandDeep : T.ink,
                  fontWeight: on ? 800 : 500, fontSize: 15, fontFamily: "inherit",
                }}>
                  <span style={{ color: on ? T.brandDark : "transparent", flexShrink: 0 }}>
                    <Icon name="check" size={17} />
                  </span>
                  {p}
                </button>
              );
            })}
          </div>
        ))}

        {remote.length > 0 && (
          <>
            <div style={{
              padding: "9px 14px 6px", fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4,
              color: T.inkFaint, textTransform: "uppercase", background: T.paper,
            }}>{t("area_more")}</div>
            {remote.map((r) => (
              <button key={"r-" + r.place + r.group} onClick={() => onPick(r.place, r)} style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%",
                padding: "12px 14px", minHeight: 48, cursor: "pointer", textAlign: "left",
                border: "none", borderBottom: `1px solid ${T.line}`,
                background: T.white, color: T.ink, fontSize: 15, fontFamily: "inherit",
              }}>
                <span style={{ color: T.inkFaint, flexShrink: 0 }}><Icon name="pin" size={16} /></span>
                <span style={{ minWidth: 0 }}>
                  {r.place}
                  {r.group && (
                    <span style={{ color: T.inkFaint, fontSize: 12.5 }}> · {r.group}</span>
                  )}
                </span>
              </button>
            ))}
          </>
        )}

        {looking && (
          <div style={{ padding: "11px 14px", fontSize: 13, color: T.inkFaint }}>
            {t("area_looking")}
          </div>
        )}

        {/* Styled as an ordinary choice, not a warning. It used to be orange
            on orange, which reads as "you are doing something wrong" -- and
            for somebody whose village genuinely is not in any list, they are
            not. This is the correct answer for them. */}
        {canUseTyped && (
          <button onClick={() => onPick(typed)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "13px 14px", minHeight: 52, cursor: "pointer", textAlign: "left",
            border: "none", borderTop: `1px solid ${T.line}`,
            background: T.white, color: T.ink, fontFamily: "inherit", fontSize: 15,
          }}>
            <span style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: T.brandSoft, color: T.brandDark,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Icon name="edit" size={16} /></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 800 }}>{typed}</span>
              <span style={{ display: "block", fontSize: 12.5, color: T.inkFaint, marginTop: 1 }}>
                {t("area_use_typed_sub")}
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- CityPicker
//
// The city comes from a LIST and the para is TYPED. Those are two different
// kinds of question and they now look like two different questions.
//
// Why the city is not typed: it is the thing everything else hangs off. The
// district follows from it, and so does a coordinate when nothing better is
// available. A typed city would have to be matched back to a row to yield
// either, and matching typed text to rows is exactly the step that produced
// the wrong district and the wrong coordinates before.
//
// Why the para is not a list: no register contains every para in Tripura and
// none ever will.
//
// Search, rather than a plain <select>: Tripura alone has enough towns that
// scrolling a native dropdown on a phone is worse than typing three letters.
export function CityPicker({ api, state, cityId, cityName, onPick }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api.cities(state, q.trim() || null)
        .then((r) => { if (alive) setRows(Array.isArray(r) ? r : r ? [r] : []); })
        .catch(() => { if (alive) setRows([]); })
        .finally(() => { if (alive) setLoading(false); });
    }, q.trim() ? 250 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [api, state, q, open]);

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setQ(""); }} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "0 13px", minHeight: 52, borderRadius: 11, cursor: "pointer",
        border: `1px solid ${T.line}`, background: T.white, textAlign: "left",
        fontFamily: "inherit", fontSize: 16.5,
      }}>
        <span style={{ color: T.inkFaint, flexShrink: 0 }}><Icon name="pin" size={19} /></span>
        <span style={{ flex: 1, color: cityName ? T.ink : T.inkFaint,
                       fontWeight: cityName ? 700 : 400, minWidth: 0,
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cityName || t("city_pick")}
        </span>
        <span style={{ color: T.inkFaint, flexShrink: 0 }}><Icon name="chev" size={18} /></span>
      </button>
    );
  }

  return (
    <div style={{ border: `1px solid ${T.brandDark}`, borderRadius: 11, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 13px",
                    borderBottom: `1px solid ${T.line}` }}>
        <span style={{ color: T.inkFaint }}><Icon name="search" size={19} /></span>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          placeholder={t("city_search_ph")}
          style={{ ...input, border: "none", padding: "14px 0", background: "transparent",
                   fontSize: 16.5, minHeight: 0 }}
        />
        <button onClick={() => setOpen(false)} aria-label={t("p_remove")} style={{
          background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 2,
        }}><Icon name="close" size={18} /></button>
      </div>

      <div style={{ maxHeight: 250, overflowY: "auto", background: T.white }}>
        {loading && rows.length === 0 && (
          <div style={{ padding: "14px", fontSize: 13.5, color: T.inkFaint }}>
            {t("area_looking")}
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div style={{ padding: "16px 14px", fontSize: 13.5, color: T.inkFaint, lineHeight: 1.6 }}>
            {t("city_none")}
          </div>
        )}
        {rows.map((c) => {
          const on = String(c.id) === String(cityId);
          return (
            <button key={c.id}
              onClick={() => { onPick(c); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%",
                padding: "12px 14px", minHeight: 50, cursor: "pointer", textAlign: "left",
                border: "none", borderBottom: `1px solid ${T.line}`,
                background: on ? T.brandSoft : T.white,
                color: on ? T.brandDeep : T.ink,
                fontWeight: on ? 800 : 500, fontSize: 15, fontFamily: "inherit",
              }}>
              <span style={{ color: on ? T.brandDark : "transparent", flexShrink: 0 }}>
                <Icon name="check" size={17} />
              </span>
              <span style={{ minWidth: 0 }}>
                {c.place}
                {c.district && (
                  <span style={{ color: T.inkFaint, fontSize: 12.5 }}> · {c.district}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- AreaInput
//
// TYPE YOUR AREA. That is the whole control.
//
// It replaces a field that opened a sheet and asked you to find your place in
// a list, with a crosshair beside it for "use my location". Both were the
// wrong default here. The list cannot contain every para in Tripura, and no
// register ever will -- and the crosshair produced a NAME by looking up the
// nearest thing in that same list, so an unlisted para came back as whichever
// village was closest. Somebody who lives in a place the register has never
// heard of was being told, confidently, that they live somewhere else.
//
// So the text box is the control and what you type is what is kept, exactly
// as typed. Suggestions appear underneath while you type and are a
// convenience: tapping one fills the box and spells it the way everyone else
// spelled it, which keeps one place from becoming four. Ignoring them costs
// nothing.
//
// Coordinates are a SEPARATE question, asked separately. They drive distance
// sorting; they are not how the place gets its name. Conflating the two is
// what produced the wrong name in the first place.
export function AreaInput({ state, value, onChange, placeholder, autoFocus }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState([]);
  const [picked, setPicked] = useState(false);
  const typed = String(value || "").trim();

  React.useEffect(() => {
    if (!open || typed.length < 3) { setRemote([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchRemote(state, typed, ctrl.signal)
        .then((rows) => setRemote(rows.slice(0, 4)))
        .catch(() => setRemote([]));
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [typed, state, open]);

  const local = typed.length >= 1 ? searchPlaces(state, typed).slice(0, 5) : [];
  const seen = new Set(local.map((r) => r.place.toLowerCase()));
  const extra = remote.filter((r) => !seen.has(r.place.toLowerCase()));
  // An exact match stays in the list: tapping it is what confirms WHICH
  // place it is (and brings its district and PIN code). Hidden only once it
  // has been picked.
  const suggestions = [...local.map((r) => r.place), ...extra.map((r) => r.place)]
    .filter((x) => !(picked && x.toLowerCase() === typed.toLowerCase()));

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 9, padding: "0 13px",
        border: `1px solid ${T.line}`, borderRadius: 11, minHeight: 52, background: T.white,
      }}>
        <span style={{ color: T.inkFaint, flexShrink: 0 }}><Icon name="pin" size={19} /></span>
        <input
          value={value || ""}
          autoFocus={autoFocus}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setPicked(false); }}
          onFocus={() => setOpen(true)}
          // A blur that fires before the tap lands would close the list out
          // from under the finger.
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          placeholder={placeholder || t("area_input_ph")}
          style={{ ...input, border: "none", padding: "14px 0", background: "transparent",
                   fontSize: 16.5, minHeight: 0 }}
        />
        {typed && (
          <button onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(""); setOpen(true); }}
            aria-label={t("p_remove")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: T.inkFaint, padding: 2, flexShrink: 0,
            }}><Icon name="close" size={17} /></button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 40,
          background: T.white, border: `1px solid ${T.line}`, borderRadius: 11,
          boxShadow: "0 6px 20px rgba(15,20,25,0.13)", overflow: "hidden",
          maxHeight: 232, overflowY: "auto",
        }}>
          <div style={{
            padding: "8px 13px 5px", fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4,
            color: T.inkFaint, textTransform: "uppercase",
          }}>{t("area_did_you_mean")}</div>
          {suggestions.map((pl) => (
            <button key={pl}
              onMouseDown={(e) => e.preventDefault()}
              // The picked place comes along with the name: its position and
              // district, so the caller can fill in the PIN code.
              onClick={() => {
                const r = extra.find((x) => x.place === pl);
                onChange(pl, r ? { lat: r.lat, lng: r.lng, district: r.district, picked: true } : { picked: true });
                setPicked(true);
                setOpen(false);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%",
                padding: "12px 13px", minHeight: 48, cursor: "pointer", textAlign: "left",
                border: "none", borderTop: `1px solid ${T.line}`, background: T.white,
                color: T.ink, fontSize: 15, fontFamily: "inherit",
              }}>
              <span style={{ color: T.inkFaint, flexShrink: 0 }}><Icon name="pin" size={16} /></span>
              {pl}
              {(() => {
                const r = extra.find((x) => x.place === pl);
                return r && r.group ? (
                  <span style={{ color: T.inkFaint, fontSize: 13 }}>· {r.group}</span>
                ) : null;
              })()}
            </button>
          ))}
        </div>
      )}

      {/* Said once, under the box: the reassurance that matters to somebody
          whose village is not in anybody's list. */}
      <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 7, lineHeight: 1.5 }}>
        {t("area_free_note")}
      </div>
    </div>
  );
}

// A closed control that opens the picker -- what a form field shows when it
// is not being edited.
export function AreaField({ state, value, onChange, placeholder }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useDismissable(open, () => setOpen(false));
  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        display: "flex", alignItems: "center", gap: 9, width: "100%",
        padding: "13px 14px", borderRadius: 11, minHeight: 52, cursor: "pointer",
        border: `1px solid ${T.line}`, background: T.white, textAlign: "left",
        fontFamily: "inherit", fontSize: 16,
        color: value ? T.ink : T.inkFaint,
      }}>
        <Icon name="pin" size={18} style={{ color: T.inkFaint }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden",
                       textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder || t("area_search_ph")}
        </span>
        <Icon name="chev" size={17} style={{ color: T.inkFaint }} />
      </button>

      {open && (
        <div
          role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 330, background: "rgba(15,20,25,0.55)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div style={{
            background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460,
            padding: "18px 16px 22px", maxHeight: "86vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 16.5, fontWeight: 800, color: T.ink, flex: 1 }}>
                {t("area_pick_in").replace("{s}", state)}
              </span>
              <CloseButton onClick={() => setOpen(false)} />
            </div>
            <AreaPicker state={state} value={value} autoFocus
                        onPick={(p) => { onChange(p); setOpen(false); }} />
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ location
//
// The location is the first decision, so it is the biggest control on the
// screen -- the pattern Rapido, Uber and Zomato all settled on, for the same
// reason: everything below it is wrong if it is wrong. It sits in the header,
// it is detected rather than asked for, and it stays put while the person
// scrolls.
//
// Detection is offered, never forced. A refused permission, a denied prompt
// or a dead geocoder all end in the same place: a text field and three
// states, which is what the person would have used anyway.
// --------------------------------------------------------------------------
export function LocationPill({ place, onOpen, compact }) {
  const { t, lang } = useI18n();
  const area = (place && place.area) || "";
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        // minWidth beats flex-shrink: without it the pill collapses to a bare
        // pin whenever the row is tight, and a lone icon is not a control.
        minWidth: 96, flex: compact ? "0 1 auto" : "1 1 150px", maxWidth: 320,
        background: "none", border: "none", cursor: "pointer",
        padding: "2px 4px", minHeight: 44, fontFamily: "inherit", textAlign: "left",
      }}
    >
      <span style={{ color: T.brandDark, flexShrink: 0 }}><Icon name="pin" size={19} /></span>
      <span style={{ minWidth: 0, lineHeight: 1.15 }}>
        <span style={{
          display: "block", fontSize: 14, fontWeight: 800, color: T.ink,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {(place && place.address) || area || t("loc_set")}
        </span>
        <span style={{
          display: "block", fontSize: 11, color: T.inkFaint, fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {stateName((place && place.state) || DEFAULT_STATE, lang)}
          {place && place.pin ? ` · ${place.pin}` : ""}
        </span>
      </span>
      <span style={{ color: T.inkFaint, flexShrink: 0 }}><Icon name="chev" size={16} /></span>
    </button>
  );
}

// -------------------------------------------------------------------- header
// Two rows on a phone: identity and location on top, navigation below. The
// single-row version pushed the tabs onto a wrapped third line and left the
// location squeezed to three characters.
export function Header({ setTab, isAdmin, tab, place, onOpenLocation, mode = null, onMode = null }) {
  const { t } = useI18n();
  // One row: who we are, where you are, which language. Everything you DO
  // lives in the bottom bar, within reach of a thumb -- two rows of small
  // controls up here was more than a first-time user could take in, and on
  // a 360px phone the language button was pushed off the edge.
  return (
    <div style={{
      background: T.white, borderBottom: `1px solid ${T.line}`,
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{
        maxWidth: 1000, margin: "0 auto", padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button
          onClick={() => setTab("browse")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                   minHeight: 44, flexShrink: 0 }}
          aria-label="Dhundo"
        >
          <DhundoLogo size={31} />
        </button>
        <span style={{ width: 1, height: 26, background: T.line, flexShrink: 0 }} />
        <LocationPill place={place} onOpen={onOpenLocation} />
        <LanguageSwitch />
      </div>

      {/* An admin's extra tools, on their own row so nobody else sees them. */}
      {isAdmin && (
        <div style={{
          maxWidth: 1000, margin: "0 auto", padding: "0 14px 8px",
          display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none",
        }}>
          <Chip active={tab === "add"} onClick={() => setTab("add")}>{t("nav_add")}</Chip>
          <Chip active={tab === "manage"} onClick={() => setTab("manage")}>{t("nav_manage")}</Chip>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- bottom bar
//
// Find, Work, Account: the three things anybody comes here to do, as big
// icons with words under them, where a thumb already is -- the pattern
// every phone user knows from PhonePe, Rapido and WhatsApp. The Work icon
// carries a green dot while the worker is online, so they can see from any
// screen that customers can still find them.
export function BottomNav({ tab, setTab, online = false, signedIn = false, hasListing = false, mode = null, onWallet = null, onMenu = null }) {
  const { t } = useI18n();
  const workTabs = ["work", "mine"];
  const current =
    tab === "account" || tab === "profile" ? "account"
    : mode === "offer" && tab === "sell" ? "sell"
    : tab === "market" || tab === "sell" ? (mode === "need" ? "find" : "market")
    : mode === "offer" && (tab === "mine" || tab === "add") ? "mine"
    : workTabs.includes(tab) || (tab === "add" && !hasListing) ? "work"
    : "find";
  const item = (key, icon, label, go, dot) => {
    const on = current === key;
    return (
      <button key={key} onClick={go} aria-current={on ? "page" : undefined} style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 3, minHeight: 60, background: "none",
        border: "none", cursor: "pointer", fontFamily: "inherit", position: "relative",
        color: on ? T.brandDark : T.inkFaint,
      }}>
        <span style={{
          width: 52, height: 30, borderRadius: 15, display: "flex", alignItems: "center",
          justifyContent: "center", background: on ? T.brandSoft : "transparent",
          position: "relative",
        }}>
          <Icon name={icon} size={23} />
          {dot && (
            <span style={{
              position: "absolute", top: 3, right: 10, width: 9, height: 9, borderRadius: "50%",
              background: "#1FA85A", border: "2px solid #fff",
            }} />
          )}
        </span>
        <span style={{ fontSize: 12, fontWeight: on ? 800 : 600, lineHeight: 1.1 }}>{label}</span>
      </button>
    );
  };
  return (
    <nav aria-label="Dhundo" style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60,
      background: T.white, borderTop: `1px solid ${T.line}`,
      boxShadow: "0 -4px 18px rgba(15,20,25,0.06)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex" }}>
        {mode === "offer" ? (
          <>
            {item("work", "construction", t("nav_dash"), () => setTab("work"), online)}
            {item("mine", "edit", t("nav_mine"), () => setTab(hasListing ? "mine" : "add"))}
            {item("sell", "tag", t("offer_sell"), () => setTab("sell"))}
            {onWallet && item("wallet", "wallet", t("wal_title"), onWallet)}
            {onMenu && item("menu", "menu", t("menu_title"), onMenu)}
          </>
        ) : mode === "need" ? (
          <>
            {item("find", "home", t("nav_home"), () => setTab("browse"))}
            {item("account", "user", signedIn ? t("nav_account") : t("nav_signin"), () => setTab("account"))}
            {onMenu && item("menu", "menu", t("menu_title"), onMenu)}
          </>
        ) : (
          <>
            {item("find", "search", t("mode_find"), () => setTab("browse"))}
            {item("market", "tag", t("mk_tab"), () => setTab("market"))}
            {item("work", "construction", t("mode_work"), () => setTab("work"), online)}
            {item("account", "user", signedIn ? t("nav_account") : t("nav_signin"), () => setTab("account"))}
          </>
        )}
      </div>
    </nav>
  );
}

// A small pulsing green dot: "this is happening now".
export function LiveDot({ light = false }) {
  return (
    <span aria-hidden="true" style={{
      display: "inline-block", width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
      background: light ? "#fff" : "#1FA85A",
      boxShadow: `0 0 0 3px ${light ? "rgba(255,255,255,0.35)" : "rgba(31,168,90,0.22)"}`,
      animation: "dhundoPulse 1.6s ease-in-out infinite",
    }}>
      <style>{"@keyframes dhundoPulse{0%,100%{opacity:1}50%{opacity:.45}}"}</style>
    </span>
  );
}

// ------------------------------------------------------------- out of area
// Shown on the page, not only in the sheet: somebody who arrives from a
// search result in Assam should learn where they stand before scrolling
// through listings that are a thousand kilometres away.
export function OutOfArea({ state, showing, onDismiss }) {
  const { t, lang } = useI18n();
  return (
    <div style={{
      maxWidth: 1000, margin: "14px auto 0", padding: "13px 15px",
      background: "#FFF6E0", border: "1px solid rgba(178,106,0,0.28)",
      borderRadius: 12, color: T.amber, fontSize: 13.5, lineHeight: 1.6,
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="pin" size={19} /></span>
      <span style={{ flex: 1 }}>
        <strong style={{ display: "block", color: "#8A5200" }}>
          {t("oos_title").replace("{x}", state)}
        </strong>
        {t("oos_body").replace("{x}", state)}
      </span>
      <button onClick={onDismiss} aria-label="Close" style={{
        background: "none", border: "none", cursor: "pointer", color: T.amber,
        padding: 2, flexShrink: 0,
      }}><Icon name="close" size={18} /></button>
    </div>
  );
}

// ---------------------------------------------------------------------- hero
// The area field used to live here beside the search box. It has moved into
// the header, where it is set once and stays visible -- having it in two
// places meant two sources of truth for the single most important filter.
// Heading colours, one per front option, matching its tile.
const HERO_TONES = {
  worker: ["#7C2D12", "#C2410C", "#EA580C"],
  shop:   ["#14532D", "#15803D", "#22A455"],
  eat:    ["#7F1D1D", "#B91C1C", "#E23B3B"],
  buy:    ["#4C1D95", "#7E22CE", "#A855F7"],
};
export function Hero({ search, setSearch, onVoice, compact = false, title = null, sub = null, placeholder = null, tone = null }) {
  const { t } = useI18n();
  // Compact once somebody is looking at results: the welcome line has done
  // its job, and on a small phone it was pushing the first card off screen.
  return (
    <div style={{
      background: HERO_TONES[tone]
        ? `linear-gradient(160deg, ${HERO_TONES[tone][0]} 0%, ${HERO_TONES[tone][1]} 55%, ${HERO_TONES[tone][2]} 100%)`
        : `linear-gradient(160deg, ${T.brandDeep} 0%, ${T.brandDark} 55%, ${T.brand} 100%)`,
      padding: compact ? "12px 16px 50px" : "30px 16px 58px", position: "relative",
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: compact ? "none" : "block" }}>
        <h1 style={{
          color: "#fff", fontSize: "clamp(23px, 5vw, 34px)", fontWeight: 800,
          lineHeight: 1.2, margin: "0 0 9px", letterSpacing: -0.4, maxWidth: 620,
        }}>{title || t("hero_title")}</h1>
        <p style={{
          color: "rgba(255,255,255,0.86)", fontSize: "clamp(13.5px, 2.6vw, 16px)",
          lineHeight: 1.6, margin: 0, maxWidth: 560,
        }}>{sub || t("hero_sub")}</p>
      </div>

      <div style={{
        maxWidth: 1000, margin: compact ? "0 auto -44px" : "22px auto -44px", background: T.white,
        borderRadius: 14, padding: 10, boxShadow: "0 14px 34px rgba(0,40,60,0.18)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 9,
          border: `1px solid ${T.line}`, borderRadius: 10, padding: "0 12px",
        }}>
          <span style={{ color: T.inkFaint }}><Icon name="search" size={20} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder={placeholder || t("search_ph")}
                 style={{ ...input, border: "none", padding: "13px 0", background: "transparent",
                          fontSize: 16 }} />
          {onVoice && <VoiceButton onHeard={onVoice} />}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- category grid
// Small circular icons, four or more to a row, like a food-delivery app.
// The previous version used big bordered cards: at 390px only two fitted per
// row, so eight categories filled the whole screen and the listings below
// were never seen.
export function CategoryGrid({ groups, counts, onPick }) {
  const { t, lang } = useI18n();
  return (
    <div style={{
      display: "grid", gap: "14px 4px",
      // Four across on the narrowest phone we care about, and simply more on
      // a wider screen -- no breakpoints to maintain. The arithmetic is tight
      // and worth writing down: a 360px screen minus 32px of page padding
      // leaves 328px, and 4x72 + 3x4 = 300. At the previous 78px and 6px gap
      // it came to 330 and silently fell back to three.
      gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
    }}>
      {groups.map((g) => {
        const s = groupStyle(g);
        const n = counts[g] || 0;
        return (
          <button key={g} onClick={() => onPick(g)} style={{
            background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
            minHeight: 44, fontFamily: "inherit",
          }}>
            <span style={{
              width: 56, height: 56, borderRadius: "50%", background: s.fg, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              boxShadow: `0 4px 10px ${s.fg}44`,
            }}>
              <Icon name={s.icon} size={27} />
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700, color: T.ink, textAlign: "center",
              lineHeight: 1.25, hyphens: "none",
            }}>
              {groupLabel(g, lang)}
            </span>
            {/* The listing count used to print here as a bare numeral --
                "Construction 6" with nothing to say what 6 was. It is on the
                trade chips inside the category, where it has a noun next to
                it. */}
          </button>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------- listing card
//
// A SCANNABLE ROW THAT OPENS
//
// The card used to print everything it had: name, category, area, distance,
// landmark, years, rate, the whole "about" paragraph, languages, and a call
// button. Six of those in one grey run of text at 13px. On a phone that is
// most of a screen for ONE person, so comparing three masons meant scrolling
// past three paragraphs, and the four facts somebody actually chooses on --
// face, trade, rate, how far -- were mixed in with the rest.
//
// So it is now two layers. Collapsed shows only what a decision needs:
//
//     [face]  Name  ✓checked
//             Mason
//             ₹700–900/day · 6 yrs
//             Panisagar · 4 km away
//
// Everything else -- the description, work photos, other trades, languages,
// a published shop address -- is behind "More details", one tap away and
// closed again with another. The call button stays visible at both sizes,
// because a person who has already decided should never have to expand
// anything to ring.
//
// Ordering is the database's job: services_browse_workers returns nearest
// first when it is given the viewer's coordinates. This component only
// renders the distance it is handed.
// ---------------------------------------------------------------------------
export function ListingCard({ row, onCall, revealing, revealed, canCall, rate, tradeLabel,
                              otherLabels, trade, nearLabel, directions, origin, posExact, roadKm, lineKm, onBook }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const s = groupStyle(row.trade_group);
  const isSupplier = row.trade_kind === "supplier";
  const initial = (row.display_name || "?").trim().charAt(0).toUpperCase();
  // DIRECTIONS in Google Maps. The exact spot when the shop shares one and
  // the customer is signed in; otherwise the area and PIN already printed on
  // the card, so the button is there on every listing and never gives away
  // more than the card itself shows.
  const areaText = [row.locality, row.city, row.pincode].filter(Boolean).join(", ");
  const from = origin && origin.exact && typeof origin.lat === "number" ? `&origin=${origin.lat},${origin.lng}` : "";
  const dirHref = directions
    ? `https://www.google.com/maps/dir/?api=1&destination=${directions.lat},${directions.lng}&travelmode=driving${from}`
    : areaText
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(areaText + ", India")}&travelmode=driving${from}`
      : null;
  const bookBtn = onBook && !row.is_example && !isSupplier && (
    <button onClick={() => onBook(row)} style={{
      display: "inline-flex", alignItems: "center", gap: 7, background: T.white, color: T.brandDark,
      border: `1.5px solid ${T.brandDark}`, padding: "10px 12px", borderRadius: 10, fontWeight: 700,
      fontSize: 14, minHeight: 46, boxSizing: "border-box", cursor: "pointer", fontFamily: "inherit",
    }}><Icon name="clock" size={17} /> {t("bk_btn")}</button>
  );
  const dirLink = dirHref && !row.is_example && (
    <a href={dirHref} target="_blank" rel="noopener noreferrer" style={{
      display: "inline-flex", alignItems: "center", gap: 7, background: T.brandDark,
      color: "#fff", padding: "12px 14px", borderRadius: 10, fontWeight: 700,
      fontSize: 15, textDecoration: "none", minHeight: 46, boxSizing: "border-box",
    }}>
      <Icon name="pin" size={18} /> {t("dir_btn")}
    </a>
  );

  // Live distances get a decimal under 10 km: "1.4 km" is the whole point
  // of knowing where an auto is now, and rounding it to "1 km" hides it.
  // The search has no distance for a listing it found without a position
  // (everybody in the state, when nobody is within reach): the straight line
  // measured on the phone from the position it may use stands in, as "about".
  const fromPhone = (row.distance_km === null || row.distance_km === undefined) && typeof lineKm === "number";
  const km = row.distance_km === null || row.distance_km === undefined
    ? (fromPhone ? lineKm : null) : Number(row.distance_km);
  const distance =
    typeof km === "number" && !Number.isNaN(km)
      ? (km < (row.available_now ? 0.3 : 1)
          ? t("dist_near")
          : t("dist_km").replace("{n}", String(row.available_now && km < 10
              ? km.toFixed(1) : Math.round(km))))
      : null;
  // A listing whose position is only the middle of its PIN code or village
  // gets an honest "about" and "area" on its distance.
  // New listings in Tripura were filed under the default city Agartala when
  // no town was chosen, so "Panisagar, Agartala" appeared for a Panisagar PIN.
  // Agartala PIN codes start 7990; a different PIN with that default city is
  // the default, not the place, and is left off.
  const cityShown = row.city === "Agartala" && row.pincode && !/^7990/.test(String(row.pincode)) ? "" : row.city;
  const roadText = typeof roadKm === "number"
    ? `${roadKm < 10 ? roadKm.toFixed(1) : Math.round(roadKm)} km \u00b7 ${t("dist_road")}` : null;
  const approx = fromPhone;
  const distanceText = roadText
    ? (posExact === false ? `\u2248 ${roadText} \u00b7 ${t("dist_area")}` : roadText)
    : distance && posExact === false && !row.available_now
      ? `\u2248 ${distance} \u00b7 ${t("dist_area")}`
      : (distance && approx ? `\u2248 ${distance}` : distance);

  const liveMins = row.available_now && row.live_seen_at
    ? Math.max(0, Math.round((Date.now() - new Date(row.live_seen_at)) / 60000))
    : null;

  const hasMore = !!(
    row.about ||
    (row.photos && row.photos.length) ||
    (row.other_trades && row.other_trades.length) ||
    (row.languages && row.languages.length) ||
    row.landmark || row.address_line
  );

  const dot = <span style={{ color: T.inkFaint }}>·</span>;

  return (
    <div style={{
      background: T.white, border: `1px solid ${T.line}`, borderRadius: 18,
      boxShadow: "0 4px 16px rgba(15,20,25,0.07)", overflow: "hidden",
    }}>
      <div style={{ display: "flex", gap: 15, alignItems: "flex-start", padding: "16px 16px 12px" }}>
        {/* Face first, then a work photo, then a picture of the trade --
            an auto for an auto driver -- with the initial on it. Round for
            a face, square otherwise, so the two are never confused. */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {row.avatar_url || (row.photos && row.photos[0]) ? (
            <div style={{
              width: 76, height: 76, overflow: "hidden",
              borderRadius: row.avatar_url ? "50%" : 16,
              background: `center/cover url(${row.avatar_url || row.photos[0]}) ${s.bg}`,
              border: row.avatar_url ? `3px solid ${T.brandSoft}` : `1px solid ${T.line}`,
              boxSizing: "border-box",
            }} />
          ) : (
            <div style={{
              width: 76, height: 76, overflow: "hidden", borderRadius: 16, background: s.bg,
              border: `1px solid ${T.line}`, boxSizing: "border-box",
            }}>
              {(() => {
                const tr = trade || { name_en: row.trade_name };
                const ic = tradeIcon(tr, s.icon);
                return (
                  <span style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                                 background: vividFor(tr.slug || tr.name_en || ic), color: "#fff" }}>
                    <Icon name={ic} size={32} />
                  </span>
                );
              })()}
            </div>
          )}
          {!row.avatar_url && (
            <span style={{
              position: "absolute", right: -6, bottom: -6, width: 28, height: 28,
              borderRadius: "50%", background: T.brandDark, color: "#fff",
              border: "2.5px solid #fff", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 800,
            }}>{initial}</span>
          )}
          {row.available_now && (
            <span style={{
              position: "absolute", left: -3, top: -3, width: 16, height: 16, borderRadius: "50%",
              background: "#1FA85A", border: "2.5px solid #fff",
            }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: T.ink, lineHeight: 1.25 }}>
              {row.display_name}
            </span>
            {row.is_example && (
              <span style={{
                fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase",
                color: T.amber, background: "#FFF5E0", border: "1px solid rgba(178,106,0,0.3)",
                padding: "2px 7px", borderRadius: 6,
              }}>{t("ex_tag")}</span>
            )}
            {row.verified && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11,
                fontWeight: 700, color: T.green, background: T.greenSoft,
                padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap",
              }}>
                <Icon name="check" size={12} /> {t("checked")}
              </span>
            )}
          </div>

          {/* Live: switched on in Work mode and heard from recently. A shop
              is "open", a person is "available". */}
          {row.available_now && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                fontSize: 12.5, fontWeight: 800, color: "#fff", background: "#1FA85A",
                padding: "4px 10px", borderRadius: 20,
              }}>
                <LiveDot light />
                {isSupplier ? t("av_badge_shop") : t("av_badge")}
              </span>
              {liveMins !== null && (
                <span style={{ fontSize: 12, color: T.inkFaint }}>
                  {liveMins < 1 ? t("av_seen_now") : t("av_seen").replace("{n}", String(liveMins))}
                </span>
              )}
            </div>
          )}

          <div style={{
            display: "inline-block", marginTop: 6, fontSize: 13.5, fontWeight: 800,
            color: s.fg, background: s.bg, padding: "4px 10px", borderRadius: 8,
          }}>{tradeLabel || row.trade_name}</div>

          {/* Rate and experience on their own line, at full ink. These are
              the two numbers people compare on, and they were previously
              the last two items in a grey run. */}
          {!isSupplier && (rate || row.years_experience) && (
            <div style={{
              display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap",
              marginTop: 7, fontSize: 14, color: T.ink,
              columnGap: 12,
            }}>
              {/* rateLabel() already ends in "/day" -- appending per_day
                  here printed "700-900/day/day". */}
              {/* No separator dot: at 390px the rate and the years wrap onto
                  two lines and the dot was left stranded at the end of the
                  first, reading as a typo. A wider gap separates them on one
                  line and nothing is orphaned on two. */}
              {rate && <span style={{ fontWeight: 800 }}>{rate}</span>}
              {row.years_experience
                ? <span style={{ color: T.inkSoft }}>
                    {row.years_experience} {t("yrs_exp")}
                  </span>
                : null}
            </div>
          )}

          <div style={{
            display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap",
            marginTop: 6, fontSize: 13, color: T.inkSoft,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon name="pin" size={14} style={{ color: T.inkFaint }} />
              {[row.locality, cityShown].filter(Boolean).join(", ")}
            </span>
            {/* Same town or same PIN code: said in words, not as a number
                of km. Positions inside a town are often rough, and "18 km"
                between two people in Panisagar is simply wrong. */}
            {nearLabel ? (
              <>
                {dot}
                <span style={{ fontWeight: 800, color: T.green }}>{nearLabel}</span>
                {roadText && (<>{dot}<span style={{ fontWeight: 700, color: T.brandDark }}>{roadText}</span></>)}
              </>
            ) : (distance || roadText) && (
              <>
                {dot}
                <span style={{ fontWeight: 700, color: T.brandDark }}>{distanceText}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- expanded */}
      {open && (
        <div style={{ padding: "0 14px 4px" }}>
          {row.photos && row.photos.length > 0 && (
            <div style={{
              display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10,
              scrollbarWidth: "none",
            }}>
              {row.photos.map((src, i) => (
                <img key={src + i} src={src} alt="" loading="lazy" style={{
                  width: 108, height: 108, objectFit: "cover", borderRadius: 11,
                  flexShrink: 0, background: T.paper, border: `1px solid ${T.line}`,
                }} />
              ))}
            </div>
          )}

          {row.about && (
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, marginBottom: 10 }}>
              {row.about}
            </div>
          )}

          {row.other_trades && row.other_trades.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.inkFaint,
                            textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                {t("also_does")}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {/* Resolved to the name in the reader's own language.
                    Printing the slug showed "supplier-tiles" to somebody
                    reading Bengali, which is neither a word nor a trade. */}
                {row.other_trades.map((slug) => (
                  <span key={slug} style={{
                    fontSize: 12.5, fontWeight: 600, color: T.ink, background: T.paper,
                    border: `1px solid ${T.line}`, padding: "5px 10px", borderRadius: 16,
                  }}>{(otherLabels && otherLabels[slug]) || slug.replace(/-/g, " ")}</span>
                ))}
              </div>
            </div>
          )}

          {/* address_line only ever arrives when its owner published it --
              65 nulls it otherwise, in the database, not here. */}
          {(row.landmark || row.address_line) && (
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10,
              fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55,
            }}>
              <span style={{ color: T.inkFaint, flexShrink: 0, marginTop: 1 }}>
                <Icon name="pin" size={15} />
              </span>
              <span>
                {row.address_line && <span style={{ color: T.ink }}>{row.address_line}<br /></span>}
                {row.landmark}
                {row.pincode ? ` — ${row.pincode}` : ""}
              </span>
            </div>
          )}

          {row.languages && row.languages.length > 0 && (
            <div style={{ fontSize: 12.5, color: T.inkFaint, marginBottom: 10 }}>
              {t("speaks")} {row.languages.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- actions */}
      <div style={{
        display: "flex", gap: 9, alignItems: "center", padding: "12px 16px 16px",
        borderTop: `1px solid ${T.line}`, marginTop: 2,
      }}>
        {row.is_example ? (
          // An example card is never callable: there is nobody behind it.
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7, minHeight: 46,
            padding: "0 14px", borderRadius: 10, background: T.paper,
            border: `1px dashed ${T.line}`, color: T.inkFaint, fontSize: 13, fontWeight: 700,
          }}>
            <Icon name="alert" size={16} /> {t("ex_cant_call")}
          </span>
        ) : revealed ? (
          <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
            <a href={`tel:${String(revealed).replace(/\s/g, "")}`} style={{
              display: "inline-flex", alignItems: "center", gap: 8, background: T.green,
              color: "#fff", padding: "12px 18px", borderRadius: 10, fontWeight: 700,
              fontSize: 15, textDecoration: "none", minHeight: 46, boxSizing: "border-box",
            }}>
              <Icon name="phone" size={18} /> {revealed}
            </a>
            <a href={waLink(revealed)} target="_blank" rel="noopener noreferrer"
               aria-label="WhatsApp" style={{
              display: "inline-flex", alignItems: "center", gap: 7, background: "#25D366",
              color: "#fff", padding: "12px 14px", borderRadius: 10, fontWeight: 700,
              fontSize: 15, textDecoration: "none", minHeight: 46, boxSizing: "border-box",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.8-4.2-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.1z"/>
              </svg>
              WhatsApp
            </a>
            {/* DIRECTIONS, for a shop that chose to show where it is. From the
                customer's own pin when they have placed one exactly, otherwise
                from wherever the phone is: the maps app asks for it. */}
            {dirLink}
            {bookBtn}
          </span>
        ) : (
          <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn kind="call" onClick={() => onCall(row)} disabled={revealing}
                 style={{ minHeight: 50, fontSize: 16.5, borderRadius: 12, whiteSpace: "nowrap",
                          padding: "0 22px" }}>
              <Icon name="phone" size={18} />
              {revealing ? "…" : canCall ? t("ft_call") : t("signin_to_call")}
            </Btn>
            {dirLink}
            {bookBtn}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {hasMore && (
          <button onClick={() => setOpen(!open)} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "none", border: "none", cursor: "pointer",
            color: T.brandDark, fontWeight: 700, fontSize: 13.5,
            minHeight: 44, fontFamily: "inherit", padding: "0 2px",
          }}>
            {open ? t("less_details") : t("more_details")}
            <span style={{ display: "inline-flex",
                           transform: open ? "rotate(180deg)" : "none" }}>
              <Icon name="chev" size={16} />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ isAdmin, onAdd }) {
  const { t } = useI18n();
  return (
    <div style={{
      background: T.white, border: `1px dashed ${T.line}`, borderRadius: 14,
      padding: "34px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: T.brandSoft, color: T.brandDark,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
      }}>
        <Icon name="search" size={24} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 6 }}>
        {t("empty_title")}
      </div>
      <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, maxWidth: 380, margin: "0 auto 18px" }}>
        {t("empty_body")}
      </div>
      <Btn onClick={onAdd}>{isAdmin ? t("empty_cta_admin") : t("empty_cta")}</Btn>
    </div>
  );
}

export function TrustBar() {
  const { t } = useI18n();
  const items = [
    ["check", t("trust_1_t"), t("trust_1_s")],
    ["phone", t("trust_2_t"), t("trust_2_s")],
    ["pin", t("trust_3_t"), t("trust_3_s")],
  ];
  return (
    <div style={{
      display: "grid", gap: 12, marginTop: 30,
      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    }}>
      {items.map(([icon, title, sub]) => (
        <div key={title} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10, background: T.brandSoft, color: T.brandDark,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon name={icon} size={18} />
          </span>
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{title}</span>
            <span style={{ display: "block", fontSize: 12.5, color: T.inkFaint, marginTop: 2, lineHeight: 1.5 }}>{sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------- footer
//
// Three short columns on a wide screen, stacked on a phone: who Dhundo is,
// where to go, and how to reach a person. The contact column appears only
// when CONTACT in brand.jsx has something in it.
//
// The data credit on the last line is required, not decorative: place
// names, villages and PIN code positions come from OpenStreetMap (ODbL) and
// GeoNames (CC BY 4.0), and both licences make a visible credit a condition
// of use. It stays in English -- it names organisations and licences.
export function SiteFooter({ setTab, hasListing = false, onInstall }) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const heading = {
    fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase",
    color: T.inkFaint, margin: "0 0 8px",
  };
  const link = {
    display: "block", background: "none", border: "none", padding: "6px 0",
    fontSize: 14, color: T.inkSoft, textAlign: "left", cursor: "pointer",
    fontFamily: "inherit", textDecoration: "none", lineHeight: "20px",
  };
  const go = (tab) => () => {
    setTab(tab);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {}
  };
  const hasContact = CONTACT.phone || CONTACT.whatsapp || CONTACT.email;

  return (
    <footer style={{ background: T.white, borderTop: `1px solid ${T.line}`, marginTop: 20 }}>
      <div style={{
        maxWidth: 1000, margin: "0 auto", padding: "26px 16px 14px",
        display: "grid", gap: 22,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <DhundoLogo size={34} showWord={false} />
            <span style={{
              fontSize: 22, fontWeight: 900, letterSpacing: 2, color: T.brandDark,
            }}>DHUNDO</span>
          </div>
          {/* The brand line, in the language the app is showing. */}
          <p style={{
            fontSize: 16, fontWeight: 700, fontStyle: "italic", color: T.ink,
            lineHeight: 1.45, margin: "10px 0 4px", maxWidth: 300,
          }}>“{t("slogan")}”</p>
          <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: 0, maxWidth: 280 }}>
            {t("trust_2_s")}
          </p>
        </div>

        <nav aria-label={t("ft_links")}>
          <p style={heading}>{t("ft_links")}</p>
          <button style={link} onClick={go("browse")}>{t("nav_home")}</button>
          <button style={link} onClick={go(hasListing ? "mine" : "add")}>
            {hasListing ? t("nav_mine") : t("nav_list")}
          </button>
          {onInstall && <button style={link} onClick={onInstall}>{t("install_app")}</button>}
          <a style={link} href="/privacy">{t("pn_link")}</a>
        </nav>

        {hasContact && (
          <div>
            <p style={heading}>{t("ft_help")}</p>
            {CONTACT.phone && (
              <a style={link} href={`tel:${CONTACT.phone.replace(/[^+\d]/g, "")}`}>
                {t("ft_call")}: {CONTACT.phone}
              </a>
            )}
            {CONTACT.whatsapp && (
              <a style={link} href={`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(t("sh_msg"))}`}
                 target="_blank" rel="noopener noreferrer">{t("sh_title")}</a>
            )}
            {CONTACT.email && (
              <a style={link} href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            )}
          </div>
        )}
      </div>

      <div style={{
        maxWidth: 1000, margin: "0 auto", padding: "12px 16px 26px",
        borderTop: `1px solid ${T.line}`,
        fontSize: 11.5, lineHeight: 1.6, color: T.inkFaint,
        display: "flex", flexWrap: "wrap", gap: "4px 14px", justifyContent: "space-between",
      }}>
        <span>
          © {year} Dhundo ·{" "}
          {/* "owned by ShortlistOne", with the name linked, in any language:
              the sentence is translated and ShortlistOne kept as written. */}
          {t("owned_by").split("ShortlistOne").map((part, i, all) => (
            <React.Fragment key={i}>
              {part}
              {i < all.length - 1 && (
                <a href="https://shortlistone.com" target="_blank" rel="noopener noreferrer"
                   style={{ color: T.brandDark, fontWeight: 700 }}>ShortlistOne</a>
              )}
            </React.Fragment>
          ))}
        </span>
        <span>
          Place data ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
             style={{ color: "inherit" }}>OpenStreetMap contributors</a>
          {" "}(ODbL) and{" "}
          <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer"
             style={{ color: "inherit" }}>GeoNames</a>
          {" "}(CC BY 4.0)
        </span>
      </div>
    </footer>
  );
}

// A WhatsApp chat link for a revealed number. Ten digits are Indian mobile
// numbers and get the 91 country code WhatsApp needs.
export function waLink(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return `https://wa.me/${d}`;
}

// ---------------------------------------------------------------- account
// Everything about "me" in one place, as big rows: sign in, my listing,
// wallet, install, sign out. It replaces four small controls that used to
// be spread over two header rows.
export function AccountPage({
  account, walletPaise = null, onOpenWallet, onSignIn, onSignOut, onInstall,
  hasListing = false, onOpenListing, onList, onOpenProfile, onOpenAds, showCredits = false,
  privacy = null, phoneOk = null, onVerifyPhone = null, onOpenRequests = null,
}) {
  const { t } = useI18n();
  const row = (icon, label, onClick, extra, sub) => (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 14, minHeight: 60,
      padding: "12px 16px", background: T.white, border: `1px solid ${T.line}`,
      borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      fontSize: 16, fontWeight: 700, color: T.ink,
    }}>
      <span style={{
        width: 40, height: 40, borderRadius: 12, background: T.brandSoft, color: T.brandDark,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}><Icon name={icon} size={21} /></span>
      <span style={{ flex: 1 }}>
        {label}
        {sub && (
          <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.inkSoft,
                         lineHeight: 1.45, marginTop: 2 }}>{sub}</span>
        )}
      </span>
      {extra}
      <Icon name="chev" size={18} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
    </button>
  );
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px 30px" }}>
      {!account ? (
        <div style={{
          background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22,
          marginBottom: 14,
        }}>
          <p style={{ fontSize: 15, color: T.inkSoft, lineHeight: 1.6, margin: "0 0 16px" }}>
            {t("au_why")}
          </p>
          <Btn full onClick={onSignIn} style={{ fontSize: 17, minHeight: 54 }}>
            <Icon name="user" size={19} /> {t("nav_signin")}
          </Btn>
          <SignupHelp style={{ margin: "14px 0 0" }} />
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          padding: "4px 2px",
        }}>
          <span style={{
            width: 52, height: 52, borderRadius: "50%", background: T.brandDark, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 21, fontWeight: 800,
          }}>{account.full_name
                ? account.full_name.trim().charAt(0).toUpperCase()
                : <Icon name="user" size={24} />}</span>
          <span>
            {/* The name when there is one; otherwise a plain heading, so
                the phone number is not printed twice. */}
            <span style={{ display: "block", fontSize: 18, fontWeight: 800 }}>
              {account.full_name || t("acc_title")}
            </span>
            <span style={{ display: "block", fontSize: 14, color: T.inkSoft }}>
              {prettyPhone(account.phone)}
            </span>
          </span>
        </div>
      )}

      {account && phoneOk === false && (
        <div style={{ marginBottom: 14, border: `1.5px solid ${T.red}`, background: T.redSoft, borderRadius: 14, padding: "13px 14px" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.55, marginBottom: 9 }}>
            {t("pv_account_msg")}
          </div>
          {onVerifyPhone && <Btn full onClick={onVerifyPhone}>{t("pv_title")}</Btn>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Two different things, kept apart on purpose. The PROFILE is
            about the person and only they see it. The LISTING is the work
            they do, with the name, address and phone customers use. */}
        {account && row("user", account.full_name ? t("prof_edit") : t("prof_create"),
          onOpenProfile, null, t("prof_sub"))}
        {account && (hasListing
          ? row("edit", t("nav_mine"), onOpenListing, null, t("acc_mine_sub"))
          : row("construction", t("nav_list"), onList, null, t("acc_list_sub")))}
        {account && onOpenAds && row("tag", t("mk_my_ads"), onOpenAds, null, t("mk_my_ads_sub"))}
        {account && walletPaise !== null && row("wallet", t("wal_title"), onOpenWallet,
          <span style={{ fontSize: 16, fontWeight: 800, color: T.green }}>{rupees(walletPaise)}</span>)}
        {account && onOpenRequests && row("check", t("rq_title"), onOpenRequests, null, t("rq_sub"))}
        {row("download", t("install_app"), onInstall)}
        {account && row("back", t("nav_signout"), onSignOut)}
      </div>

      {/* What the person has allowed, and a way to take it back. */}
      {privacy}

      {/* In the app, where there is no footer: the ownership line and the
          credit the OpenStreetMap and GeoNames licences require. */}
      {showCredits && (
        <div style={{ marginTop: 26, fontSize: 12, lineHeight: 1.6, color: T.inkFaint, textAlign: "center" }}>
          <div style={{ fontWeight: 900, letterSpacing: 2, color: T.brandDark, fontSize: 14 }}>DHUNDO</div>
          <div style={{ fontStyle: "italic", color: T.inkSoft, margin: "2px 0 8px" }}>“{t("slogan")}”</div>
          <div>{t("owned_by")}</div>
          <div style={{ marginTop: 6 }}>
            Place data © OpenStreetMap contributors (ODbL) and GeoNames (CC BY 4.0)
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- profile
// The person, not their work. Name, email, address -- for the account.
// Customers never see it; what they see is the listing. The phone is the
// sign-in number, shown but not editable here.
export function ProfilePage({ api, account, hasListing = false, onBack, onList, onSaved, PlaceFieldComp = null, currentPlace = null, onLocation = null }) {
  const { t } = useI18n();
  const consent = useConsent();
  const [f, setF] = useState({
    full_name: (account && account.full_name) || "", email: "", address: "",
    city: "", state: "", pincode: "",
  });
  // The person own position: where they are, for searching. Not a listing.
  const [home, setHome] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => { setMsg(null); setF((p) => ({ ...p, [k]: v })); };

  React.useEffect(() => {
    let live = true;
    api.myProfile().then((p) => {
      if (!live || !p) return;
      setF({
        full_name: p.full_name || (account && account.full_name) || "",
        email: p.email || "", address: p.address || "", city: p.city || "",
        state: p.state || "", pincode: p.pincode || "",
      });
      if (typeof p.home_lat === "number") setHome({ lat: p.home_lat, lng: p.home_lng, exact: p.home_exact === true });
      else if (currentPlace && typeof currentPlace.lat === "number") {
        // Nothing saved yet: start from the location already set on the
        // landing screen, so it is not asked for twice.
        setF((x) => ({ ...x, city: x.city || currentPlace.area || "", state: x.state || currentPlace.state || "",
          pincode: x.pincode || currentPlace.pin || "", address: x.address || currentPlace.address || "" }));
        setHome({ lat: currentPlace.lat, lng: currentPlace.lng, exact: currentPlace.exact === true });
      }
    }).catch(() => {}).finally(() => live && setLoaded(true));
    return () => { live = false; };
    // Once, on opening. Saving the name renews the session and with it
    // `api`; reloading then would put back what the server had a moment ago.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!f.full_name.trim()) return setMsg({ tone: "bad", text: t("ae_name") });
    // An address, an email or a PIN is stored: a yes first. The name alone
    // is already covered by the account consent given at sign-up.
    if ((f.email || f.address || f.city || f.pincode) && !(await consent.ask("profile"))) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api.updateMyProfile(f);
      if (r && r.ok && api.setHome && (home || PlaceFieldComp)) {
        try { await api.setHome(home ? home.lat : null, home ? home.lng : null, home ? home.exact : false); } catch (_) {}
      }
      if (r && r.ok) {
        // Saving a profile location moves the landing screen to it too.
        if (onLocation && home) onLocation({ lat: home.lat, lng: home.lng, exact: home.exact, area: f.city, state: f.state, pin: f.pincode, address: f.address });
        setMsg({ tone: "good", text: t("p_saved") });
        onSaved && onSaved(r.profile);
      } else {
        const why = r && r.reason;
        setMsg({ tone: "bad", text: t(
          why === "bad_name" ? "ae_name" : why === "bad_email" ? "prof_e_email"
          : why === "bad_pincode" ? "e_badpin" : why === "bad_state" ? "e_badstate" : "e_save") });
      }
    } catch (e) {
      // Too many tries or no consent on record: already worded for the person.
      setMsg({ tone: "bad", text: e && e.code ? e.message : t("e_save") });
    } finally { setBusy(false); }
  };

  const field = { ...input, minHeight: 52, fontSize: 16, padding: "13px 14px", borderRadius: 11 };
  const label = (text, children) => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{text}</span>
      {children}
    </label>
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "18px 16px 30px" }}>
      <button onClick={onBack} style={{
        display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
        color: T.brandDark, fontSize: 15, fontWeight: 700, cursor: "pointer", padding: "6px 0",
        marginBottom: 6, fontFamily: "inherit",
      }}><Icon name="back" size={18} /> {t("w_back")}</button>
      <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 4px" }}>{t("prof_title")}</h1>
      <p style={{ fontSize: 14.5, color: T.inkSoft, margin: "0 0 18px", lineHeight: 1.6 }}>
        {t("prof_intro")}
      </p>

      <div style={{
        background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18,
        opacity: loaded ? 1 : 0.6,
      }}>
        {label(t("au_name"),
          <input style={field} value={f.full_name} autoComplete="name" maxLength={80}
                 onChange={(e) => set("full_name", e.target.value)} />)}
        {label(t("au_phone"),
          <>
            <input style={{ ...field, background: T.paper, color: T.inkSoft }} readOnly
                   value={prettyPhone(account && account.phone)} />
            <span style={{ display: "block", fontSize: 12.5, color: T.inkFaint, marginTop: 5 }}>
              {t("prof_phone_note")}
            </span>
          </>)}
        {label(t("prof_email"),
          <input style={field} type="email" inputMode="email" autoComplete="email" value={f.email}
                 onChange={(e) => set("email", e.target.value)} />)}
        {PlaceFieldComp ? (
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("prof_myloc")}</span>
            <span style={{ display: "block", fontSize: 12.5, color: T.inkFaint, marginBottom: 8, lineHeight: 1.5 }}>
              {t("prof_myloc_note")}
            </span>
            <PlaceFieldComp
              value={(f.city || f.state || home) ? {
                area: f.city, state: f.state, pin: f.pincode, address: f.address,
                lat: home ? home.lat : undefined, lng: home ? home.lng : undefined,
                exact: home ? home.exact : undefined,
              } : null}
              onChange={(p) => {
                setMsg(null);
                setF((x) => ({ ...x, city: p.area || "", state: p.state || x.state,
                  pincode: p.pin || "", address: p.address || "" }));
                setHome(typeof p.lat === "number" ? { lat: p.lat, lng: p.lng, exact: !!p.exact } : null);
              }}
            />
          </div>
        ) : (<>
        {label(t("prof_address"),
          <textarea style={{ ...field, minHeight: 76, resize: "vertical" }} value={f.address}
                    autoComplete="street-address" maxLength={300}
                    onChange={(e) => set("address", e.target.value)} />)}
        {label(t("prof_city"),
          <input style={field} value={f.city} autoComplete="address-level2" maxLength={80}
                 onChange={(e) => set("city", e.target.value)} />)}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px" }}>
            {label(t("state_label"),
              <StateSelect big value={f.state} onChange={(v) => set("state", v)}
                           style={{ display: "block", width: "100%" }} />)}
          </div>
          <div style={{ flex: "1 1 140px" }}>
            {label(t("p_pincode"),
              <input style={field} inputMode="numeric" maxLength={6} value={f.pincode}
                     autoComplete="postal-code"
                     onChange={async (e) => {
                       const d = e.target.value.replace(/\D/g, "").slice(0, 6);
                       set("pincode", d);
                       // A full PIN code fills in the town and state when empty.
                       if (d.length === 6) {
                         const r = await pinLookup(d);
                         if (r) setF((p) => ({ ...p,
                           city: p.city || r.place || "",
                           state: p.state || (STATES.includes(r.state) ? r.state : "") }));
                       }
                     }} />)}
          </div>
        </div>
</>)}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Btn full onClick={save} disabled={busy || !loaded} style={{ fontSize: 17, minHeight: 54 }}>
          {busy ? "…" : t("p_save")}
        </Btn>
      </div>

      {/* The listing is a separate thing -- say so where people look. */}
      <div style={{
        marginTop: 16, background: T.brandSoft, borderRadius: 16, padding: 18,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{t("prof_list_q")}</div>
        <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 12px", lineHeight: 1.55 }}>
          {t("prof_list_body")}
        </p>
        <Btn kind="ghost" onClick={onList}>
          <Icon name={hasListing ? "edit" : "construction"} size={18} />{" "}
          {hasListing ? t("nav_mine") : t("nav_list")}
        </Btn>
      </div>
    </div>
  );
}

// -------------------------------------------------------- first-visit lang
// The very first screen, once: every language as a big button in its own
// script. Somebody who cannot read English will never find a small "EN" in
// a corner -- but they will find বাংলা or हिन्दी on a full screen.
export function LanguageGate({ onDone }) {
  const { lang, setLang } = useI18n();
  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, zIndex: 200, background: T.paper, overflowY: "auto",
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 16px 32px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <DhundoLogo size={40} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, textAlign: "center", margin: "0 0 4px" }}>
          Choose your language
        </h1>
        <p style={{ fontSize: 15, color: T.inkSoft, textAlign: "center", margin: "0 0 20px", lineHeight: 1.6 }}>
          भाषा चुनें · ভাষা বেছে নিন · மொழியைத் தேர்ந்தெடுக்கவும்
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {LANGS.map((l) => {
            const on = l.code === lang;
            return (
              <button key={l.code} onClick={() => { setLang(l.code); onDone(); }} style={{
                minHeight: 64, borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                fontSize: 20, fontWeight: 800,
                border: `2px solid ${on ? T.brandDark : T.line}`,
                background: on ? T.brandSoft : T.white, color: on ? T.brandDeep : T.ink,
              }}>{l.label}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------- popular trades
// The trades people ask for most, as big tiles that go straight to people:
// one tap for "plumber" instead of Repairs -> Plumber. Ordered by how many
// listings each has, so what shows first is what has somebody behind it.
export function PopularTrades({ trades, onPick, limit = 8 }) {
  const { lang } = useI18n();
  const top = [...trades]
    .sort((a, b) => Number(b.listing_count || 0) - Number(a.listing_count || 0))
    .slice(0, limit);
  if (!top.length) return null;
  return (
    <div style={{
      display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    }}>
      {top.map((tr) => {
        const s = groupStyle(tr.group_name);
        const icon = (
          <span style={{
            width: "100%", height: "100%", background: s.bg, color: s.fg,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Icon name={s.icon} size={40} /></span>
        );
        return (
          <button key={tr.slug} onClick={() => onPick(tr)} style={{
            display: "flex", flexDirection: "column", padding: 0, overflow: "hidden",
            borderRadius: 16, cursor: "pointer", textAlign: "left",
            background: T.white, border: `1px solid ${T.line}`, fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(15,20,25,0.06)",
          }}>
            {/* A picture first: somebody who reads little still knows an
                auto when they see one. */}
            <span style={{ display: "block", width: "100%", aspectRatio: "16 / 10", background: s.bg }}>
              {icon}
            </span>
            <span style={{
              display: "block", padding: "9px 11px 11px", fontSize: 15, fontWeight: 800,
              color: T.ink, lineHeight: 1.25,
            }}>
              {tradeName(tr, lang)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------- voice search
// Speak instead of type, in the language the app is showing. Chrome on
// Android supports every Indian language here; where the browser cannot
// listen, the button simply does not appear.
const SPEECH_LANG = {
  en: "en-IN", hi: "hi-IN", bn: "bn-IN", mr: "mr-IN", te: "te-IN", ta: "ta-IN",
  gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", or: "or-IN", pa: "pa-IN", as: "as-IN",
};
export function VoiceButton({ onHeard }) {
  const { t, lang } = useI18n();
  const [listening, setListening] = useState(false);
  const Rec = typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!Rec) return null;
  const start = () => {
    try {
      const r = new Rec();
      r.lang = SPEECH_LANG[lang] || "en-IN";
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        const said = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript;
        if (said) onHeard(said.trim());
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      setListening(true);
      r.start();
    } catch (_) { setListening(false); }
  };
  return (
    <button onClick={start} aria-label={t("voice_listen")} title={t("voice_listen")} style={{
      width: 44, height: 44, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
      border: "none", display: "flex", alignItems: "center", justifyContent: "center",
      background: listening ? T.red : T.brandDark, color: "#fff",
      animation: listening ? "dhundoPulse 1s ease-in-out infinite" : "none",
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}

// Which trade somebody meant, from what they typed or said -- in any of the
// languages the trade names exist in. "प्लंबर", "plumber" and "প্লাম্বার"
// all land on the same trade instead of a text search that finds nothing.
export function matchTrade(text, trades) {
  const all = matchTrades(text, trades);
  return all.length === 1 ? all[0] : null;
}

// Every trade the words could mean, best first. One when it is clear;
// two or more when a word fits several ("paint": painter and paint shop),
// and the search then shows all of them together.
export function matchTrades(text, trades) {
  const q = String(text || "").trim().toLowerCase();
  if (q.length < 2) return [];
  let best = null;
  for (const tr of trades) {
    for (const name of [tr.name_en, tr.name_hi, tr.name_bn]) {
      const n = String(name || "").toLowerCase();
      if (!n) continue;
      if (n === q) return [tr];
      const first = n.split(/[\s(,/]+/)[0];
      if (!best && (q.includes(first) && first.length >= 3)) best = tr;
    }
  }
  if (best) return [best];
  // Then the everyday words, in all twelve languages (tradewords.js):
  // "nalwala", "பிளம்பர்", "సుతార్". Matched to a trade by the start of a
  // word in its English name, so "paint" finds "Painter" but "rod" does not
  // find "Hardware products".
  const keys = tradeKeysFor(q);
  if (!keys) return [];
  const out = [];
  for (const k of keys) {
    const re = new RegExp("(^|[^a-z])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    trades.forEach((t) => {
      if (re.test(String(t.name_en || "").toLowerCase()) && !out.includes(t)) out.push(t);
    });
  }
  return out.slice(0, 4);
}
