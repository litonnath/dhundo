// ===========================================================================
// regions.js -- the places this directory covers, as a real list.
//
// WHY THIS EXISTS
// The area was a free text field. That quietly breaks the product: a worker
// types "panisagar", somebody searching types "Panisagar", a third person
// types "Panisagar, North Tripura", and the like-match finds two of the
// three. Multiply that by a few hundred listings and the locality filter
// stops being trustworthy, which is the one filter that matters most in a
// LOCAL directory.
//
// A fixed list also lets the interface be tapped rather than typed, which
// matters for somebody who is not fast on a phone keyboard, and it works in
// Bengali and Hindi without anyone having to transliterate anything.
//
// ---------------------------------------------------------------------------
// ACCURACY -- PLEASE READ
// ---------------------------------------------------------------------------
// This list was written from general knowledge, not from an official
// gazetteer, and Liton knows Tripura far better than any list I can compile.
// Expect to correct it. Adding, renaming or removing a place is one line
// here and a redeploy -- no migration, because listings store the NAME.
//
// If it grows past a few hundred entries, or you want to edit it without a
// deploy, it belongs in a services_regions table instead. That is a small
// change: this file's shape is already { state: [{ group, places: [] }] }.
//
// The names are kept in Latin script for now, deliberately: people search
// for "Panisagar" in all three interface languages, and half-transliterated
// place names read worse than untranslated ones. If that turns out to be
// wrong in practice, each entry can become { en, bn, hi } without any other
// file changing.
// ===========================================================================

export const REGIONS = {
  Tripura: [
    {
      // Where most of the early listings will be, so it is first and split
      // into localities rather than treated as one place.
      group: "Agartala",
      places: [
        "Krishnanagar", "Banamalipur", "Bhati Abhoynagar", "Abhoynagar",
        "Ramnagar", "Joynagar", "Dhaleswar", "Indranagar", "Kunjaban",
        "College Tilla", "Shibnagar", "Math Chowmuhani", "Battala",
        "Melarmath", "Arundhatinagar", "Bordowali", "Pratapgarh",
        "Amtali", "Badharghat", "Jogendranagar", "Durga Chowmuhani",
        "Airport Road", "Lake Chowmuhani", "Kaman Chowmuhani",
      ],
    },
    {
      group: "West Tripura",
      places: ["Mohanpur", "Jirania", "Ranirbazar", "Hezamara", "Lefunga", "Old Agartala"],
    },
    {
      group: "Sepahijala",
      places: ["Bishalgarh", "Sonamura", "Melaghar", "Jampuijala", "Boxanagar", "Charilam"],
    },
    {
      group: "Khowai",
      places: ["Khowai", "Teliamura", "Kalyanpur", "Padmabil", "Tulashikhar"],
    },
    {
      group: "Gomati",
      places: ["Udaipur", "Amarpur", "Karbook", "Kakraban", "Matabari", "Tepania"],
    },
    {
      group: "South Tripura",
      places: ["Belonia", "Santirbazar", "Sabroom", "Rajnagar", "Hrishyamukh", "Bagafa"],
    },
    {
      group: "Dhalai",
      places: ["Ambassa", "Kamalpur", "Gandacherra", "Longtharai Valley", "Manu", "Chhamanu"],
    },
    {
      group: "Unakoti",
      places: ["Kailashahar", "Kumarghat", "Pecharthal", "Chandipur"],
    },
    {
      group: "North Tripura",
      places: ["Dharmanagar", "Panisagar", "Kanchanpur", "Damcherra", "Jubarajnagar", "Kadamtala"],
    },
  ],

  Delhi: [
    {
      group: "South Delhi",
      places: ["Saket", "Hauz Khas", "Greater Kailash", "Lajpat Nagar", "Kalkaji",
               "Nehru Place", "Malviya Nagar", "Vasant Kunj", "Munirka", "Mehrauli",
               "Okhla", "Badarpur"],
    },
    {
      group: "West Delhi",
      places: ["Janakpuri", "Dwarka", "Uttam Nagar", "Rajouri Garden", "Tilak Nagar",
               "Paschim Vihar", "Najafgarh", "Vikaspuri", "Punjabi Bagh"],
    },
    {
      group: "North Delhi",
      places: ["Rohini", "Pitampura", "Model Town", "Ashok Vihar", "Burari",
               "Narela", "Civil Lines", "Shalimar Bagh", "Karol Bagh"],
    },
    {
      group: "East Delhi",
      places: ["Laxmi Nagar", "Mayur Vihar", "Preet Vihar", "Shahdara",
               "Karawal Nagar", "Vivek Vihar", "Patparganj", "Dilshad Garden"],
    },
    {
      group: "Central Delhi",
      places: ["Connaught Place", "Chandni Chowk", "Daryaganj", "Paharganj", "Rajinder Nagar"],
    },
  ],

  Haryana: [
    {
      group: "NCR",
      places: ["Gurugram", "Faridabad", "Manesar", "Ballabgarh", "Sohna",
               "Bahadurgarh", "Palwal", "Nuh", "Dharuhera"],
    },
    {
      group: "North Haryana",
      places: ["Ambala", "Panchkula", "Kalka", "Yamunanagar", "Kurukshetra",
               "Thanesar", "Karnal", "Panipat", "Kaithal", "Pehowa"],
    },
    {
      group: "West Haryana",
      places: ["Hisar", "Sirsa", "Fatehabad", "Bhiwani", "Charkhi Dadri", "Hansi"],
    },
    {
      group: "South & Central",
      places: ["Rohtak", "Sonipat", "Jhajjar", "Jind", "Gohana", "Rewari",
               "Narnaul", "Mahendragarh"],
    },
  ],
};

// A flat list per state, for searching.
export function placesIn(state) {
  const groups = REGIONS[state] || [];
  const out = [];
  groups.forEach((g) => g.places.forEach((p) => out.push({ place: p, group: g.group })));
  return out;
}

// Case- and punctuation-insensitive, and matches on the district name too,
// so typing "north tripura" surfaces Dharmanagar and Panisagar.
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function searchPlaces(state, query) {
  const all = placesIn(state);
  // Every likely English spelling of what was typed, so "কৃষ্ণনগর" finds
  // Krishnanagar in this English list. norm() alone would strip the
  // Bengali letters and match everything.
  const qs = (hasIndic(query) ? variants(query, 8) : [query]).map(norm).filter(Boolean);
  if (!qs.length) return all;
  const starts = [];
  const contains = [];
  all.forEach((row) => {
    const p = norm(row.place);
    if (qs.some((q) => p.startsWith(q))) starts.push(row);
    else if (qs.some((q) => p.includes(q) || norm(row.group).includes(q))) contains.push(row);
  });
  // Prefix matches first: typing "kri" should put Krishnanagar at the top
  // rather than somewhere below a place that merely contains those letters.
  return starts.concat(contains);
}

// Is a typed string one of the known places? Used to decide whether to offer
// "use what I typed" as an explicit extra choice rather than silently
// accepting anything.
export function isKnownPlace(state, value) {
  const v = norm(value);
  return placesIn(state).some((row) => norm(row.place) === v);
}

// Geolocation returns whatever OpenStreetMap calls the neighbourhood, which
// is often close to but not exactly a name in this list ("Krishna Nagar" vs
// "Krishnanagar"). Snapping to the known name keeps detected and typed
// locations in the same vocabulary; with no match the detected name is used
// as-is rather than thrown away.
export function snapToKnown(state, detected) {
  if (!detected) return detected;
  const d = norm(detected);
  const all = placesIn(state);
  const exact = all.find((row) => norm(row.place) === d);
  if (exact) return exact.place;
  const partial = all.find((row) => norm(row.place).includes(d) || d.includes(norm(row.place)));
  return partial ? partial.place : detected;
}


// ===========================================================================
// LIVE PLACE SEARCH
//
// The curated list above covers the places we know about. This covers the
// ones we do not: a village, a new colony, a landmark somebody's customers
// actually use as an address.
//
// WHY PHOTON AND NOT GOOGLE PLACES
// Google's Places Autocomplete is billed per keystroke session and needs an
// account with a card on it. For a directory over three states that is a
// recurring bill for a result set that barely changes. Photon is Komoot's
// open geocoder over OpenStreetMap data: no key, no billing, CORS open, and
// built for type-ahead specifically -- unlike Nominatim, whose usage policy
// asks people NOT to use it for autocomplete.
//
// To move to Google later, only searchRemote() changes: everything above and
// every caller deals in plain place names.
//
// HOW IT BEHAVES WHEN IT FAILS
// It returns [] and says nothing. The curated list is rendered from memory
// and needs no network, so a dead geocoder, an offline phone or a blocked
// request costs the person nothing they would notice. That is the reason the
// local list stays rather than being replaced by this.
// ===========================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import * as CFG from "./config.js";
import { STATE_CENTERS, normalizeState } from "./states.js";
import { hasIndic, variants } from "./translit.js";

const PHOTON = "https://photon.komoot.io/api/";

// Roughly centred on Agartala. Photon weights results near this point, which
// is what stops "Ramnagar" returning a suburb of Nagpur first.
const BIAS = { lat: 23.83, lon: 91.28 };

// EVERY settlement, not just the big ones. Photon tags places by osm_key
// "place", and that one key covers city, town, village, hamlet, suburb,
// neighbourhood, locality, isolated_dwelling and farm alike -- so keying on
// it takes the smallest para along with the district town.
//
// An earlier version listed the types by hand and left out "hamlet" and
// "isolated_dwelling", which quietly excluded most of rural Tripura: exactly
// the places where a directory of local workers is worth the most and a
// municipal list is worth the least.
//
// What is still rejected is everything that is not a settlement: individual
// houses, shops, bus stops, roads. A list of those is noise dressed up as
// precision, and none of them is an answer to "which area do you work in?".
const PLACE_KEYS = new Set(["place", "boundary"]);
const REJECT_VALUES = new Set(["house", "houses", "building", "bus_stop", "shop",
                               "yes", "residential_road"]);

// ---------------------------------------------------------------------------
// YOUR OWN DATA FIRST
//
// services_regions holds the official village list plus anything you have
// added by hand, so it is both more complete for Tripura than any geocoder
// and instant -- one indexed query, no third party, no per-search cost.
//
// The geocoder stays as a fallback for the case where the table has nothing:
// a brand-new colony, or a state whose import has not been run yet. It is
// asked second and only when the table came back empty, so in normal use no
// request leaves your infrastructure at all.
// ---------------------------------------------------------------------------
// services_search_places (91) returns the position of each place; the older
// services_search_regions does not, which left every place picked from the
// search without one. The older one is only a fallback until 91 is run.
async function searchDb(state, q, signal) {
  return (await searchDbX(state, q, signal)).rows;
}

// The same, saying whether the table could be asked at all: a timeout is not
// "no such place", and the person should not be told it is.
async function searchDbX(state, q, signal) {
  const first = await searchDbOnce(state, q, signal);
  // A timeout on the first read of an index that is not in memory yet is
  // common and the same search a moment later is instant, so one more try.
  if (first.failed && !(signal && signal.aborted) && (first.status === 0 || first.status >= 500)) {
    await new Promise((r) => setTimeout(r, 500));
    if (signal && signal.aborted) return first;
    return searchDbOnce(state, q, signal);
  }
  return first;
}

// Asked once per state per visit, when the location sheet opens: it reads the
// index into memory, so the first real search is not the one that pays.
const warmed = new Set();
export function warmPlaceSearch(state) {
  const k = state || "";
  if (warmed.has(k)) return;
  warmed.add(k);
  searchDbOnce(state, "ti").catch(() => {});
}

async function searchDbOnce(state, q, signal) {
  const call = (fn) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_state: state || null, p_query: q, p_limit: 25 }),
  });
  try {
    let res = await call("services_search_places");
    // The older function only when the new one is not installed (404). A
    // timeout is not a reason to ask the slower of the two as well.
    if (res.status === 404) res = await call("services_search_regions");
    if (!res.ok) return { rows: [], failed: true, status: res.status };
    const rows = await res.json();
    if (!Array.isArray(rows)) return { rows: [], failed: true, status: 0 };
    // One entry per name and district: the map place and the post office
    // of the same village are the same choice. The first, the map one, wins.
    const seen = new Set();
    const out = rows.filter((r) => {
      const k = `${String(r.place || "").toLowerCase()}|${r.district || ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map((r) => ({
      place: r.place,
      // The district is what separates three villages that share a name,
      // which is common enough in Tripura to matter.
      group: [r.block, r.district].filter(Boolean).join(", "),
      district: r.district || null,
      // Where it is, when the table knows: picking the place then sorts
      // results by distance even without the phone's GPS.
      lat: typeof r.lat === "number" ? r.lat : null,
      lng: typeof r.lng === "number" ? r.lng : null,
    }));
    return { rows: out, failed: false };
  } catch (_) {
    return { rows: [], failed: !(signal && signal.aborted), status: 0 };
  }
}

// Where a named place is, for a place chosen WITHOUT a position -- a name
// from the built-in list, or one typed by hand. Without it the search can
// only match the area name exactly, and a customer in "Dharmanagar" never
// sees a shop listed under the village next door. An exact name match from
// the place table, or null.
//
// `near` is a hint for places that share a name -- the heading the name was
// listed under ("Agartala" for Ramnagar), matched against the district and
// block, so Ramnagar in Agartala is not taken for a Ramnagar elsewhere.
export async function placeCoords(state, name, near) {
  const n = String(name || "").trim();
  if (n.length < 3) return null;
  const rows = await searchDb(state, n);
  const low = n.toLowerCase();
  const exact = rows.filter((r) => String(r.place || "").toLowerCase() === low && typeof r.lat === "number");
  const h = String(near || "").toLowerCase();
  const hit = (h && exact.find((r) => String(r.group || "").toLowerCase().includes(h))) || exact[0];
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

// The places nearest a phone position, nearest first, one per name. The
// map service names the nearest mapped TOWN when a village is only a dot on
// the map ("Panisagar" for somebody in Tilthai); this table has the village.
export async function nearestPlaces(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/services_nearest_places`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_lat: lat, p_lng: lng, p_limit: 12 }),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter((r) => {
      const k = String(r.place || "").toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 6);
  } catch (_) {
    return [];
  }
}

// A PIN code row with its place name tidied: the postal data names the
// place after its post office -- "Dharmanagar H.O", "Kadamtala S.O" -- and
// the office type means nothing to the person reading it.
function cleanPin(r) {
  if (!r || !r.pincode) return null;
  const place = String(r.place || "")
    .replace(/\s*[([]?\b(?:G\.?\s?P\.?\s?O|H\.?\s?O|S\.?\s?O|B\.?\s?O|E\.?\s?D\.?\s?S\.?\s?O|P\.?\s?O)\b\.?[)\]]?\s*$/i, "")
    .trim();
  return { ...r, place };
}

async function rpcPin(fn, body) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return cleanPin(Array.isArray(rows) ? rows[0] : rows);
  } catch (_) {
    return null;
  }
}

// The PIN code nearest a position -- how "same PIN code" is worked out for
// somebody who did not type theirs. { pincode, place, district } or null.
export async function pinNear(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/services_pin_near`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_lat: lat, p_lng: lng }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const r = Array.isArray(rows) ? rows[0] : rows;
    return cleanPin(r);
  } catch (_) {
    return null;
  }
}

// The PIN code for a chosen place, however it can be found: from its
// position, else from its name (and district) -- so picking a village never
// leaves the PIN empty just because the village has no position of its own.
// { pincode, place } or null.
export async function pinForPlace({ lat, lng, name, state, district, postcode } = {}) {
  // 1. The post office of that name: exact India Post data -- "Tilthai
  //    Nutanbazar B.O" is 799260. The PIN-centre positions are rough, so a
  //    position alone once gave Tilthai the PIN of Dharmanagar.
  if (name) {
    const byOffice = await rpcPin("services_pin_by_office",
      { p_state: state || null, p_place: name, p_district: district || null });
    if (byOffice) return byOffice;
  }
  // 1b. The PIN the map itself has for that very spot (an address with a
  //     postcode in OpenStreetMap): better than the PIN centre nearest.
  const mapPin = validPin(postcode);
  if (mapPin) return { pincode: mapPin, place: "" };
  // 2. The PIN centre nearest the position.
  const byPos = await pinNear(lat, lng);
  if (byPos) return byPos;
  if (!name) return null;
  // 3. By the name, through the PIN list and the map.
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/services_pin_by_name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_state: state || null, p_place: name, p_district: district || null }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const r = Array.isArray(rows) ? rows[0] : rows;
    return cleanPin(r);
  } catch (_) {
    return null;
  }
}

// A typed PIN code: where it is and what it is called.
export async function pinLookup(pin) {
  const d = String(pin || "").replace(/\D/g, "");
  if (d.length !== 6) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/services_pincode_lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_pin: d }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const r = Array.isArray(rows) ? rows[0] : rows;
    return cleanPin(r);
  } catch (_) {
    return null;
  }
}

// The name to show for a phone position: the nearest village or locality
// from the place table when one is close (a post office only when very
// close, its position being rougher), otherwise what the map service said.
export function bestNearName(near, fallback) {
  // A village on record right under the point wins; otherwise the name the
  // map itself gave this spot (Deocheera must not become Panisagar just
  // because Panisagar is the nearest row we hold); then the nearest row.
  const under = near.find((r) => r.source !== "post" && r.km <= 0.8);
  if (under) return under.place;
  if (fallback) return fallback;
  const map = near.find((r) => r.source !== "post" && r.km <= 2.5);
  if (map) return map.place;
  const any = near.find((r) => r.km <= 1.2);
  return any ? any.place : fallback;
}

export async function searchRemote(state, query, signal) {
  const typed = String(query || "").trim();
  // Typed in an Indian script: search under each likely English spelling
  // until one finds places -- the place list is stored in English letters.
  const spellings = hasIndic(typed) ? variants(typed, 5) : [typed];
  let q = spellings[0];
  if (q.length < 3) return [];

  let mine = [];
  for (const sp of spellings) {
    if (sp.length < 3) continue;
    mine = await searchDb(state, sp, signal);
    if (mine.length) { q = sp; break; }
  }
  // Filter out anything already shown in the built-in list above, so the
  // same place is never offered twice.
  const fromDb = mine.filter((r) => !isKnownPlace(state, r.place));
  if (fromDb.length > 0) return fromDb.slice(0, 15);

  const c = STATE_CENTERS[state];
  const bias = c ? { lat: c[0], lon: c[1] } : BIAS;
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=25&lang=en` +
              `&lat=${bias.lat}&lon=${bias.lon}`;

  let body;
  try {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    body = await res.json();
  } catch (_) {
    return [];   // offline, blocked, aborted -- all the same to the caller
  }

  const nq = norm(q);
  const seen = new Set();
  const out = [];
  (body.features || []).forEach((feat) => {
    const p = feat.properties || {};
    const xy = (feat.geometry && feat.geometry.coordinates) || [];
    if (p.countrycode && p.countrycode !== "IN") return;
    // Restricted to the state being browsed: offering a Ramnagar in Uttar
    // Pradesh to somebody picking a place in Bihar would file a listing
    // somewhere it can never be found.
    if (state && p.state && !sameState(p.state, state)) return;
    const key = p.osm_key || "";
    const val = p.osm_value || "";
    if (REJECT_VALUES.has(val)) return;
    // A settlement, an administrative area, or something Photon itself
    // classified as a locality-ish result.
    if (key && !PLACE_KEYS.has(key) && p.type !== "locality" && p.type !== "district") return;

    const name = p.name;
    if (!name) return;

    // RELEVANCE, not fuzziness. Photon ranks loosely: searching "tilthai"
    // came back with Dharmanagar, Damcherra and Tepania -- none of which
    // contains those letters, and all of which are real places somewhere
    // else entirely. Offering them invites somebody to file their listing
    // under a village an hour away because it was the only row on screen.
    //
    // A result now has to share its beginning with what was typed, or
    // contain it outright. If nothing does, the honest answer is an empty
    // list and the "not on the list" row -- which is a true statement about
    // OpenStreetMap's coverage rather than a wrong suggestion.
    const nn = norm(name);
    if (!(nn.startsWith(nq) || nn.includes(nq) || nq.includes(nn))) return;
    const dedupe = norm(name);
    if (seen.has(dedupe)) return;
    // Already offered above, so offering it twice would just be two rows
    // that do the same thing.
    if (isKnownPlace(state, name)) return;
    seen.add(dedupe);

    out.push({
      place: name,
      // For a hamlet this is the only thing distinguishing three places that
      // share a name, so it is assembled from whatever Photon gives rather
      // than taking the first non-empty field.
      group: [p.district, p.county, p.city]
               .filter((x) => x && norm(x) !== norm(name))
               .slice(0, 2)
               .join(", ") || p.state || "",
      lat: typeof xy[1] === "number" ? xy[1] : null,
      lng: typeof xy[0] === "number" ? xy[0] : null,
    });
  });
  return out.slice(0, 12);
}

// OSM writes some state names differently from the way this app does.
function sameState(osmState, ours) {
  if (normalizeState(osmState) === ours) return true;
  const a = norm(osmState), b = norm(ours);
  if (a === b) return true;
  if (b === "delhi") return a.includes("delhi");          // "National Capital Territory of Delhi"
  return a.includes(b) || b.includes(a);
}


// ===========================================================================
// SEARCH FOR ANYWHERE -- roads, shops, landmarks, villages
//
// What "type your location" runs on, the way Uber and Rapido do it: a road, a
// shop, a school, a colony or a village, anywhere in India, each with the
// position it has on the map. Three sources, asked in this order:
//   1. our own place table (villages, with positions, instant);
//   2. Photon, over OpenStreetMap -- shops, roads and landmarks included;
//   3. Nominatim, OpenStreetMap's own search, only when both came back empty
//      (it asks for no more than a request a second).
// Whatever none of them knows can still be placed with the pin on the map.
// ===========================================================================
const INDIA_BBOX = "68.0,6.5,97.5,35.8";
const anyCache = new Map();
let lastNominatim = 0;

const clean = (x) => String(x == null ? "" : x).trim();

export function validPin(x) {
  const d = clean(x).replace(/\s/g, "");
  return /^[1-9]\d{5}$/.test(d) ? d : null;
}

// Parts joined with commas, empty ones and repeats left out.
function uniqueJoin(parts) {
  const seen = new Set();
  return parts.map(clean).filter((x) => {
    const k = x.toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join(", ");
}

// The address as people say it, from what OpenStreetMap knows about a spot:
// house, road, locality, village or town, district -- and the PIN code when
// it has one. Parts the map does not have are simply left out.
export function addressFrom(a, display) {
  a = a || {};
  let line = uniqueJoin([
    a.house_number, a.road, a.neighbourhood || a.suburb || a.quarter,
    a.village || a.hamlet || a.town || a.city, a.state_district || a.county,
  ]);
  if (!line && display) line = String(display).split(",").slice(0, 3).join(",").trim();
  return { line: line || null, postcode: validPin(a.postcode), road: a.road || null };
}

function fromPhoton(f) {
  const p = (f && f.properties) || {};
  const xy = (f && f.geometry && f.geometry.coordinates) || [];
  if (typeof xy[1] !== "number" || typeof xy[0] !== "number") return null;
  if (p.countrycode && p.countrycode !== "IN") return null;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const title = clean(p.name) || street;
  if (!title) return null;
  const isPlace = p.osm_key === "place" || p.osm_key === "boundary";
  const locality = clean(p.locality || p.district);
  const town = clean(p.city);
  return {
    title,
    subtitle: uniqueJoin([street !== title ? street : "", locality, town, p.county, p.state])
      .split(", ").filter((x) => x.toLowerCase() !== title.toLowerCase()).join(", "),
    lat: xy[1], lng: xy[0],
    state: p.state ? normalizeState(p.state) : null,
    district: clean(p.county || p.district) || null,
    area: isPlace ? title : (locality || town || clean(p.county)),
    line: isPlace ? uniqueJoin([title, town, p.county])
                  : uniqueJoin([p.name, street, locality, town, p.county]),
    postcode: validPin(p.postcode),
    kind: isPlace ? "place" : (p.osm_key || "poi"),
  };
}

function fromNominatim(r) {
  const a = (r && r.address) || {};
  const lat = parseFloat(r && r.lat), lng = parseFloat(r && r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (a.country_code && a.country_code !== "in") return null;
  const road = [a.house_number, a.road].filter(Boolean).join(" ");
  const loc = clean(a.neighbourhood || a.suburb || a.quarter || a.village || a.hamlet || a.town || a.city || a.city_district);
  const town = clean(a.village || a.town || a.city || a.hamlet);
  const title = clean(r.name) || road || loc || clean(String(r.display_name || "").split(",")[0]);
  if (!title) return null;
  return {
    title,
    subtitle: uniqueJoin([road !== title ? road : "", loc !== title ? loc : "", town, a.state_district || a.county, a.state])
      .split(", ").filter((x) => x.toLowerCase() !== title.toLowerCase()).join(", "),
    lat, lng,
    state: a.state ? normalizeState(a.state) : null,
    district: clean(a.state_district || a.county) || null,
    area: loc || town || title,
    line: uniqueJoin([r.name && r.name !== loc ? r.name : "", road, loc, town, a.state_district || a.county]),
    postcode: validPin(a.postcode),
    kind: r.category || "poi",
  };
}

// ONE WAY TO ASK THE MAP SERVICES.
//
// First through this site's own server (/geo/photon, /geo/nominatim -- see
// deploy/nginx-geo.conf), which asks them once, with a name they can identify,
// and remembers the answers. That is what OpenStreetMap's usage policy wants,
// and it sidesteps everything that makes a browser's own request fail on one
// laptop and not on a phone: an ad-blocker, a school or office network, a
// rate limit shared by everybody behind one address.
//
// Where that is not set up -- the answer is a 404, or the page itself -- the
// public servers are asked directly, as before.
const GEO_DIRECT = { photon: "https://photon.komoot.io/", nominatim: "https://nominatim.openstreetmap.org/" };
let geoProxy = null; // null = not tried yet, true = works, false = not there

export async function geoJson(service, rel, signal) {
  if (geoProxy !== false) {
    try {
      const res = await fetch(`/geo/${service}/${rel}`, { signal, headers: { Accept: "application/json" } });
      const type = res.headers.get("content-type") || "";
      if (res.ok && type.includes("json")) { geoProxy = true; return await res.json(); }
      // A 404, or 200 with the site's own page: there is no proxy here.
      if (res.status === 404 || res.ok) geoProxy = false;
      // Anything else (429, 502): the proxy exists but was refused upstream;
      // try the public server for this one request and keep the proxy.
    } catch (e) {
      if (signal && signal.aborted) throw e;
    }
  }
  const res = await fetch(GEO_DIRECT[service] + rel, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) { const e = new Error(String(res.status)); e.status = res.status; throw e; }
  return res.json();
}

const whyFailed = (e) => (e && e.status ? `HTTP ${e.status}` : "blocked or offline");

async function politeNominatim() {
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
}

export async function searchAnywhere(query, { state, near, signal } = {}) {
  const q = clean(query);
  if (q.length < 3) return { rows: [], failed: false, partial: false, detail: "" };
  const key = `${state || ""}|${q.toLowerCase()}`;
  const hit = anyCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.out;
  const aborted = () => !!(signal && signal.aborted);

  // 1. Our own table: the villages, with positions.
  const spellings = hasIndic(q) ? variants(q, 4) : [q];
  let mine = [];
  let ownErr = null;
  for (const sp of spellings) {
    if (clean(sp).length < 3) continue;
    const got = await searchDbX(state, sp, signal);
    if (got.failed) { ownErr = got.status ? `HTTP ${got.status}` : "unreachable"; break; }
    mine = got.rows;
    if (mine.length) break;
  }
  const own = mine.slice(0, 6).map((r) => ({
    title: r.place,
    subtitle: uniqueJoin([r.group, state]),
    lat: r.lat, lng: r.lng, state: state || null, district: r.district,
    area: r.place, line: uniqueJoin([r.place, r.district]), postcode: null, kind: "place",
  }));

  // 2. Photon: shops, roads, landmarks and settlements anywhere in India.
  const c = near && typeof near.lat === "number" ? { lat: near.lat, lon: near.lng }
          : STATE_CENTERS[state] ? { lat: STATE_CENTERS[state][0], lon: STATE_CENTERS[state][1] } : BIAS;
  let remote = [];
  let photonErr = null, nomErr = null, triedNom = false;
  try {
    const sp = spellings.find((x) => clean(x).length >= 3) || q;
    const j = await geoJson("photon",
      `api/?q=${encodeURIComponent(sp)}&limit=12&lang=en&lat=${c.lat}&lon=${c.lon}&bbox=${INDIA_BBOX}`, signal);
    remote = (j.features || []).map(fromPhoton).filter(Boolean);
  } catch (e) {
    if (aborted()) return { rows: [], failed: false, partial: false, detail: "" };
    photonErr = whyFailed(e);
  }

  // 3. Nominatim, only when nothing else found anything.
  if (!own.length && !remote.length) {
    try {
      triedNom = true;
      await politeNominatim();
      const rows = await geoJson("nominatim",
        "search?format=jsonv2&addressdetails=1&limit=8&countrycodes=in&accept-language=en" +
        `&q=${encodeURIComponent(q)}`, signal);
      remote = (Array.isArray(rows) ? rows : []).map(fromNominatim).filter(Boolean);
    } catch (e) {
      if (aborted()) return { rows: [], failed: false, partial: false, detail: "" };
      nomErr = whyFailed(e);
    }
  }

  // Places in the state being worked in come before the rest (a Tilhar in
  // Uttar Pradesh is not what somebody in Tripura typed), then by closeness.
  const km = (r) => (near && typeof r.lat === "number"
    ? Math.hypot(r.lat - near.lat, (r.lng - near.lng) * 0.9) : 1e9);
  remote.sort((a, b) => ((b.state === state) - (a.state === state)) || (km(a) - km(b)));

  const seen = new Set();
  const rows = [...own, ...remote].filter((r) => {
    const k = `${r.title}|${r.subtitle}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 12);
  // "Nothing found" and "could not ask" are different answers: the first is
  // about the place, the second about the connection, and the person should
  // be told which.
  const failed = !rows.length && (!!ownErr || (!!photonErr && (!triedNom || !!nomErr)));
  const detail = [
    ownErr ? `places: ${ownErr}` : "",
    photonErr ? `photon: ${photonErr}` : "",
    triedNom && nomErr ? `nominatim: ${nomErr}` : "",
  ].filter(Boolean).join(", ");
  // `partial`: our own village list could not be asked, so the rows shown are
  // only what the map services know.
  const out = { rows, failed, partial: !!ownErr, detail: failed || ownErr ? detail : "" };
  if (!aborted() && !failed && !ownErr) {
    anyCache.set(key, { at: Date.now(), out });
    if (anyCache.size > 60) anyCache.delete(anyCache.keys().next().value);
  }
  return out;
}

// What is at a point on the map: the address, the state, the PIN the map has.
export async function reverseLookup(lat, lng, signal) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  try {
    await politeNominatim();
    const body = await geoJson("nominatim",
      "reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en" +
      `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`, signal);
    const a = (body && body.address) || {};
    return {
      area: a.suburb || a.neighbourhood || a.quarter || a.village || a.hamlet || a.town || a.city_district || a.county || null,
      state: a.state ? normalizeState(a.state) : null,
      address: addressFrom(a, body && body.display_name),
    };
  } catch (_) {
    return null;
  }
}

// A saved place whose position does not fit its state (Tripura's coordinates
// under Haryana) is not a place: it made results appear from the wrong state.
export function placeIsCoherent(p) {
  if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return true;
  if (p.lat < 5 || p.lat > 38 || p.lng < 67 || p.lng > 98.5) return false;
  const c = STATE_CENTERS[p.state];
  if (!c) return true;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (p.lat - c[0]) * rad, dLng = (p.lng - c[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(c[0] * rad) * Math.cos(p.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) <= 800;
}


// ---------------------------------------------------------------------------
// GOOGLE MAP TILES, WITH A MONTHLY ALLOWANCE
// Needs GOOGLE_MAPS_KEY in src/config.js (the key must be restricted to this
// site in Google Cloud). One call here = one Google session, counted in the
// database (sql/99) so every device shares one count. False -- no key, the
// allowance is used up, the count could not be read -- means "draw the free
// map instead".
// ---------------------------------------------------------------------------
export async function takeGoogleMap(kind = "tiles") {
  const key = CFG.GOOGLE_MAPS_KEY;
  if (!key || /YOUR/i.test(key)) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/services_gmap_take`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_kind: kind }),
    });
    if (!res.ok) return false;
    const j = await res.json();
    return !!(j && j.ok);
  } catch (_) {
    return false;
  }
}

// kind: "sat" (photographs with road and place names) or "road". The tile
// session is made once per kind and kept in `store`.
export function googleTileUrl(kind, store) {
  const key = CFG.GOOGLE_MAPS_KEY;
  if (!store[kind]) {
    const body = kind === "sat"
      ? { mapType: "satellite", language: "en-IN", region: "IN", layerTypes: ["layerRoadmap"] }
      : { mapType: "roadmap", language: "en-IN", region: "IN" };
    store[kind] = fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.session
        ? `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${j.session}&key=${key}` : null))
      .catch(() => null);
  }
  return store[kind];
}


// ---------------------------------------------------------------------------
// GOOGLE ADDRESS AND NEARBY PLACES FOR A SAVED PIN
// Asked once when a pin is saved (not while the map is dragged), each kind
// against its own monthly allowance (sql/100). The key must also allow
// "Geocoding API" and "Places API (New)". Null on any failure -- the caller
// then uses the free OpenStreetMap lookup.
// ---------------------------------------------------------------------------
export async function googleDescribe(lat, lng) {
  const key = CFG.GOOGLE_MAPS_KEY;
  if (!key || /YOUR/i.test(key) || typeof lat !== "number") return null;
  const out = { address: null, area: null, state: null, places: [] };
  const [geo, near] = await Promise.all([
    (async () => {
      if (!(await takeGoogleMap("geocode"))) return null;
      const r = await fetch("https://maps.googleapis.com/maps/api/geocode/json?latlng=" +
        `${lat},${lng}&language=en&region=in&key=${key}`);
      const j = r.ok ? await r.json() : null;
      return j && j.status === "OK" ? j.results : null;
    })().catch(() => null),
    (async () => {
      if (!(await takeGoogleMap("nearby"))) return null;
      const r = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.displayName,places.location,places.primaryTypeDisplayName",
        },
        body: JSON.stringify({
          maxResultCount: 8, rankPreference: "DISTANCE", languageCode: "en", regionCode: "IN",
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 300 } },
        }),
      });
      const j = r.ok ? await r.json() : null;
      return j && j.places ? j.places : null;
    })().catch(() => null),
  ]);
  if (geo && geo.length) {
    const comp = (type) => {
      for (const res of geo) {
        const c = (res.address_components || []).find((x) => x.types.includes(type));
        if (c) return c.long_name;
      }
      return null;
    };
    const road = comp("route");
    const area = comp("sublocality_level_1") || comp("sublocality") || comp("neighborhood") || comp("locality");
    const town = comp("locality");
    const district = comp("administrative_area_level_3") || comp("administrative_area_level_2");
    const st = comp("administrative_area_level_1");
    out.state = st ? normalizeState(st) : null;
    out.area = area || town || null;
    out.address = {
      line: uniqueJoin([comp("premise"), road, area, town, district]) || null,
      postcode: validPin(comp("postal_code")), road: road || null,
    };
  }
  if (near) {
    out.places = near.map((p) => ({
      name: p.displayName && p.displayName.text, type: p.primaryTypeDisplayName && p.primaryTypeDisplayName.text,
    })).filter((p) => p.name);
  }
  return out.address || out.places.length ? out : null;
}


// Google place search for the box on the map: run when Enter is pressed (not
// on every letter, which is what makes search the costly Google call), biased
// to where the map is looking. Own allowance, kind "search" (sql/101).
export async function googleSearch(query, lat, lng) {
  const key = CFG.GOOGLE_MAPS_KEY;
  const q = String(query || "").trim();
  if (!key || /YOUR/i.test(key) || q.length < 3) return [];
  if (!(await takeGoogleMap("search"))) return [];
  try {
    const body = { textQuery: q, languageCode: "en", regionCode: "IN", pageSize: 6 };
    if (typeof lat === "number") {
      body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
    }
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return ((j && j.places) || []).map((p) => ({
      title: (p.displayName && p.displayName.text) || "",
      line: p.formattedAddress || "",
      lat: p.location && p.location.latitude, lng: p.location && p.location.longitude,
      kind: "poi", source: "google",
    })).filter((x) => x.title && typeof x.lat === "number");
  } catch (_) {
    return [];
  }
}
