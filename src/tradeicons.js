// Icon and colour for a trade or category, chosen from its English name.
// One line icon per kind of food place or shop, picked from the English name
// (the database holds the trades, not their pictures).
// Strong, saturated colours for the tile icons, picked from the name so a tile
// keeps its colour. White line icon on a solid square, not a faded tint.
const VIVID = ["#EA580C", "#2563EB", "#16A34A", "#DC2626", "#7C3AED", "#0D9488", "#D97706", "#DB2777", "#0891B2", "#4F46E5"];
export const vividFor = (key) => {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return VIVID[h % VIVID.length];
};
const ICON_RULES = [
  // food places and food work
  [/tea|snack|chai/, "teacup"], [/bakery|sweet|halwai|mithai|cake/, "cake"], [/fast food|biryani|burger|pizza|momo/, "burger"],
  [/dhaba|curry/, "pot"], [/tiffin|lunch/, "tiffin"], [/cater/, "cloche"],
  [/cook|chef|waiter|serving|restaurant|canteen|mess|food/, "cutlery"], [/hotel|lodge|resort/, "bed"], [/homestay|guest/, "home"],
  // home and care
  [/security|guard/, "shield"], [/garden|mali|plant/, "leaf"], [/maid|housekeep|clean|sweep/, "broom"],
  [/nanny|child|elder|attendant|care/, "heart"], [/laundry|iron/, "shirt"], [/pest/, "bug"], [/tailor/, "scissors"],
  [/beautician|makeup/, "sparkle"], [/barber|salon/, "scissors"], [/packers|movers/, "bag"],
  // building
  [/car wash/, "drop"], [/mason|rajmistri/, "bricks"], [/carpenter|centering|shuttering|furniture|ply|timber|wood|door/, "timber"],
  [/electrician|wiring|electric|wire|bulb|light/, "bolt"], [/plumb|sanitary|bath/, "tap"],
  [/painter|painting|polish|waterproof|denting|paint/, "roller"], [/welder|grill|hardware|tool/, "repairs"],
  [/tile|marble|granite/, "tiles"], [/pop|ceiling|\btin\b|roof|shed/, "sheets"], [/contractor|labour|helper/, "construction"],
  [/borewell|pump|pipe|tank/, "pipes"], [/glass|alumin/, "glass"], [/cement/, "bag"], [/brick|sand|stone|gravel|chips/, "bricks"],
  [/steel|rod|tmt|iron/, "rods"],
  // repairs, vehicles, events
  [/\bac\b|fridge|refrigerator|cooling/, "snow"], [/washing machine|appliance/, "repairs"], [/mobile|phone/, "phone"],
  [/computer|laptop/, "laptop"], [/cctv|photo|video|drone|camera/, "camera"], [/inverter|solar|purohit|priest|pandit/, "sun"],
  [/truck|lorry/, "truck"], [/school van|\bbus\b|\bvan\b/, "bus"], [/ambulance/, "ambulance"], [/tractor/, "tractor"],
  [/jcb|excavator|crane|hydra/, "crane"], [/delivery|2-wheeler/, "bike"],
  [/car mechanic|car\b/, "drivers"], [/bike|scooter|tyre|puncture/, "vehicle"],
  [/decor|tent/, "events"], [/\bdj\b|sound/, "music"], [/driver|rider|taxi|auto|toto/, "drivers"],
];
export function tradeIcon(tr, fallback) {
  const k = `${tr.name_en || ""} ${tr.slug || ""}`.toLowerCase();
  const hit = ICON_RULES.find(([re]) => re.test(k));
  return hit ? hit[1] : fallback;
}

