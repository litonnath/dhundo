// ===========================================================================
// translit.js -- turn text typed in any Indian script into English letters,
// so it can be searched against names and places stored in English.
//
// "সুকান্ত" -> "sukanta", "आगरतला" / "আগরতলা" -> "agartala",
// "கிருஷ்ணநகர்" -> "kirushnanakar" (Tamil has no separate g/k -- see below).
//
// WHY ONE TABLE COVERS NINE SCRIPTS
// Unicode lays out Devanagari, Bengali/Assamese, Gurmukhi, Gujarati, Odia,
// Tamil, Telugu, Kannada and Malayalam on the same pattern: the letter for
// "ka" sits at offset 0x15 in each block, "ta" at 0x24, and so on. So the
// sound is looked up by offset, and the block only says which script it is.
//
// WHAT IT CANNOT DO
// Spelling in English letters is not standardised -- Das/Dash, Debnath/
// Debnaath. So a search gets a few spellings (variants()), not one, and
// the caller searches for each. Tamil writes k/g, t/d and p/b with one
// letter each, so a Tamil spelling of "Agartala" reads "akartala"; the
// variants include the voiced forms for Tamil too.
// ===========================================================================

const BLOCKS = [
  [0x0900, "dev"], [0x0980, "beng"], [0x0a00, "guru"], [0x0a80, "guj"], [0x0b00, "orya"],
  [0x0b80, "taml"], [0x0c00, "telu"], [0x0c80, "knda"], [0x0d00, "mlym"],
];

const VOWELS = {
  0x05: "a", 0x06: "a", 0x07: "i", 0x08: "i", 0x09: "u", 0x0a: "u", 0x0b: "ri",
  0x0e: "e", 0x0f: "e", 0x10: "ai", 0x12: "o", 0x13: "o", 0x14: "au",
};
const SIGNS = {
  0x3e: "a", 0x3f: "i", 0x40: "i", 0x41: "u", 0x42: "u", 0x43: "ri",
  0x46: "e", 0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au",
};
const CONS = {
  0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
  0x1a: "ch", 0x1b: "chh", 0x1c: "j", 0x1d: "jh", 0x1e: "n",
  0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
  0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n", 0x29: "n",
  0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
  0x2f: "y", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "zh",
  0x35: "v", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  0x58: "q", 0x59: "kh", 0x5a: "g", 0x5b: "z", 0x5c: "r", 0x5d: "rh", 0x5e: "f", 0x5f: "y",
};
// Letters that sit outside the common pattern in one script.
const SPECIAL = {
  0x09f0: "r", 0x09f1: "w", 0x09ce: "t",                 // Assamese ra, wa; Bengali khanda ta
  0x09dc: "r", 0x09dd: "rh", 0x09df: "y",                // Bengali ড় ঢ় য়
  0x0b5c: "r", 0x0b5d: "rh", 0x0b5f: "y", 0x0b71: "w",   // Odia
  0x0a70: "n", 0x0a71: "",                                // Gurmukhi tippi, addak
  0x0d7a: "n", 0x0d7b: "n", 0x0d7c: "r", 0x0d7d: "l", 0x0d7e: "l", 0x0d7f: "k", // Malayalam chillu
};
const VIRAMA = 0x4d;
const NASAL = new Set([0x01, 0x02]);   // candrabindu, anusvara -> n
const VISARGA = 0x03;
const NUKTA = 0x3c;

function blockOf(cp) {
  for (const [start, name] of BLOCKS) {
    if (cp >= start && cp < start + 0x80) return [start, name];
  }
  return null;
}

export function hasIndic(text) {
  for (const ch of String(text || "")) {
    if (blockOf(ch.codePointAt(0))) return true;
  }
  return false;
}

// Syllables: each is { c: consonants, v: vowel, inherent: bool }.
function syllables(word) {
  const out = [];
  let cur = null;
  let script = null;
  const push = () => { if (cur) out.push(cur); cur = null; };
  for (const ch of word) {
    const cp = ch.codePointAt(0);
    if (SPECIAL[cp] !== undefined) {
      const sound = SPECIAL[cp];
      if (cp === 0x0a70) { if (cur) cur.v += "n"; continue; }        // tippi: a nasal
      if (!sound) continue;                                         // addak: no sound of its own
      if (cp === 0x09ce || cp >= 0x0d7a) {                          // never carries a vowel
        push(); out.push({ c: sound, v: "", inherent: false }); continue;
      }
      if (cur && cur.joined) { cur.c += sound; cur.v = "a"; cur.inherent = true; cur.joined = false; }
      else { push(); cur = { c: sound, v: "a", inherent: true }; }
      continue;
    }
    const b = blockOf(cp);
    if (!b) { push(); out.push({ c: ch.toLowerCase(), v: "", inherent: false, raw: true }); continue; }
    script = b[1];
    const off = cp - b[0];
    if (CONS[off] !== undefined) {
      // A consonant after a virama joins the cluster; otherwise it starts
      // a new syllable with the inherent "a".
      if (cur && cur.joined) { cur.c += CONS[off]; cur.v = "a"; cur.inherent = true; cur.joined = false; }
      else { push(); cur = { c: CONS[off], v: "a", inherent: true }; }
    } else if (SIGNS[off] !== undefined) {
      if (cur) { cur.v = SIGNS[off]; cur.inherent = false; }
    } else if (off === VIRAMA) {
      if (cur) { cur.v = ""; cur.inherent = false; cur.joined = true; }
    } else if (VOWELS[off] !== undefined) {
      push(); cur = { c: "", v: VOWELS[off], inherent: false };
    } else if (NASAL.has(off)) {
      const nasal = script === "mlym" ? "m" : "n";
      // The syllable now has a sound after its vowel, so its "a" is heard.
      if (cur) { cur.v += nasal; cur.inherent = false; }
      else out.push({ c: nasal, v: "", inherent: false });
    } else if (off === VISARGA) {
      if (cur) { cur.v += "h"; cur.inherent = false; }
    } else if (off === NUKTA) {
      // no sound of its own here
    } else if (off >= 0x66 && off <= 0x6f) {
      push(); out.push({ c: String(off - 0x66), v: "", inherent: false, raw: true });
    }
  }
  push();
  return { syl: out, script };
}

function join(syl) {
  return syl.map((s) => s.c + s.v).join("")
    // A nasal before m, b or p is said "m" -- and before m it is the same
    // sound written twice: "anmritsar" is Amritsar.
    .replace(/n(?=[pbm])/g, "m").replace(/mm/g, "m");
}

// The plain reading, with every inherent "a" kept: "agaratala".
function fullReading(word) {
  return join(syllables(word).syl);
}

// The spoken readings. Hindi, Bengali and their neighbours drop the final
// inherent "a" and usually one in the middle -- "आगरतला" is said agartala,
// not agaratala -- but which middle one depends on the word. So every
// single middle drop is offered, and the search tries each.
function spokenReadings(word) {
  const { syl } = syllables(word);
  const base = syl.map((x) => ({ ...x }));
  const n = base.length;
  if (n > 1 && base[n - 1].inherent) base[n - 1].v = "";
  const out = [join(base)];
  for (let i = 1; i < n - 1; i++) {
    if (!base[i].inherent || !base[i].c || !base[i + 1].c || base[i - 1].v === "") continue;
    const s = base.map((x) => ({ ...x }));
    s[i].v = "";
    out.push(join(s));
  }
  return out;
}

const DEVOICE = [["k", "g"], ["t", "d"], ["p", "b"], ["ch", "j"]];

// A few English spellings of what was typed, most likely first. Latin text
// is returned as it is.
export function variants(text, limit = 8) {
  const src = String(text || "").trim();
  if (!src || !hasIndic(src)) return src ? [src] : [];
  const words = src.split(/\s+/);
  // Per word: its spoken readings, then the full one. Only the longest
  // word gets its alternatives multiplied, which keeps the list short.
  const per = words.map((w) => {
    const r = spokenReadings(w);
    const full = fullReading(w);
    return r.includes(full) ? r : [...r, full];
  });
  let longest = 0;
  per.forEach((r, i) => { if (words[i].length > words[longest].length) longest = i; });
  const base = per[longest].map((alt) =>
    per.map((r, i) => (i === longest ? alt : r[0])).join(" "));

  const out = [];
  const add = (v) => { if (v && !out.includes(v)) out.push(v); };
  for (const v of base) {
    add(v);
    // English spellings often write one letter where the script has two
    // ("malappuram" / "malapuram") and "s" for "sh" ("bhubaneswar").
    add(v.replace(/([bcdfghjklmnpqrstvwxz])\1/g, "$1"));
    add(v.replace(/sh/g, "s"));
    // Tamil writes k/g, t/d, p/b and ch/j with one letter each.
    if (/[\u0b80-\u0bff]/.test(src)) {
      let voiced = v;
      for (const [hard, soft] of DEVOICE) {
        voiced = voiced.replace(new RegExp("([aeiou])" + hard, "g"), "$1" + soft);
      }
      add(voiced);
    }
  }
  return out.slice(0, limit);
}

// The single best English spelling.
export function toLatin(text) {
  return variants(text)[0] || "";
}
