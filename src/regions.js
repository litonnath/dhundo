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
async function searchDb(state, q, signal) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/services_search_regions`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_state: state || null, p_query: q, p_limit: 25 }),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      place: r.place,
      // The district is what separates three villages that share a name,
      // which is common enough in Tripura to matter.
      group: [r.block, r.district].filter(Boolean).join(", "),
    }));
  } catch (_) {
    return [];
  }
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
