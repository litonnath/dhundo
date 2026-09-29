// ===========================================================================
// tradepics.jsx -- a picture for each trade, so somebody who reads little
// can still tell "auto" from "glass shop" at a glance.
//
// REAL PHOTOS FIRST
// Put a photo in src/assets/trades/ named after the picture key below --
// auto.jpg, glass.jpg, pipes.webp -- and rebuild. It replaces the drawing
// for that trade everywhere. Use your own photos, or ones whose licence
// allows it (Pexels and Unsplash photos are free to use). Landscape, about
// 640x400, under 100 KB each keeps the home screen fast on a slow phone.
//
// DRAWINGS OTHERWISE
// Each is a small scene drawn here: an auto with its driver, a window in an
// aluminium frame, a tank with pipes. No download, works offline, and never
// a broken image.
// ===========================================================================
import React from "react";

const PHOTOS = import.meta.glob("./assets/trades/*.{jpg,jpeg,png,webp}", {
  eager: true, query: "?url", import: "default",
});
const photoFor = (key) => {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const url = PHOTOS[`./assets/trades/${key}.${ext}`];
    if (url) return url;
  }
  return null;
};

// Which picture a trade gets, from its English name. Most specific first:
// "Electrical goods" is the shop, "Electrician" the person.
const RULES = [
  [/auto|rickshaw|toto/, "auto"],
  [/glass|alumin/, "glass"],
  [/pipe|tank/, "pipes"],
  [/tin|roof/, "roof"],
  [/sanitary|bathroom/, "sanitary"],
  [/electrical|wire/, "electrical"],
  [/electric/, "electrician"],
  [/plumb/, "plumber"],
  [/mason|mistri|rajmistri/, "mason"],
  [/carpent|furniture/, "carpenter"],
  [/paints\b|paint shop/, "paints"],
  [/paint/, "painter"],
  [/cement/, "cement"],
  [/sand|stone|gravel|chips/, "sand"],
  [/brick/, "bricks"],
  [/steel|rod|tmt|iron/, "steel"],
  [/hardware/, "hardware"],
  [/tile|marble|granite/, "tiles"],
  [/plywood|timber|wood|door/, "plywood"],
  [/weld/, "welder"],
  [/mechanic/, "mechanic"],
  [/tailor|darzi/, "tailor"],
  [/cook|chef|caterer/, "cook"],
  [/maid|domestic|house ?help|clean/, "maid"],
  [/driver|taxi|car/, "driver"],
];
export function pictureKey(trade) {
  const n = String((trade && trade.name_en) || "").toLowerCase();
  for (const [re, key] of RULES) if (re.test(n)) return key;
  return null;
}

// ------------------------------------------------------------ pieces
const SKIN = "#B97A4C";
const HAIR = "#2A1A10";

// A person standing, feet at (x, y). `arm` bends the right arm towards
// (ax, ay) so they can hold a tool.
function Person({ x, y, shirt = "#2F6FB5", pants = "#39404A", s = 1, ax, ay, cap }) {
  const h = 46 * s;
  const top = y - h;
  const hx = x, hy = top + 7 * s;
  const sx = x + 7 * s, sy = top + 17 * s;
  return (
    <g>
      <rect x={x - 6 * s} y={y - 18 * s} width={5 * s} height={18 * s} rx={2 * s} fill={pants} />
      <rect x={x + 1 * s} y={y - 18 * s} width={5 * s} height={18 * s} rx={2 * s} fill={pants} />
      <rect x={x - 8 * s} y={top + 13 * s} width={16 * s} height={17 * s} rx={5 * s} fill={shirt} />
      <line x1={x - 7 * s} y1={sy} x2={x - 11 * s} y2={sy + 12 * s} stroke={shirt} strokeWidth={4.5 * s} strokeLinecap="round" />
      <line x1={sx} y1={sy} x2={ax ?? x + 11 * s} y2={ay ?? sy + 12 * s} stroke={shirt} strokeWidth={4.5 * s} strokeLinecap="round" />
      <circle cx={ax ?? x + 11 * s} cy={ay ?? sy + 12 * s} r={2.4 * s} fill={SKIN} />
      <circle cx={hx} cy={hy} r={7 * s} fill={SKIN} />
      <path d={`M${hx - 7 * s} ${hy - 1 * s} a${7 * s} ${7 * s} 0 0 1 ${14 * s} 0 q${-7 * s} ${-4 * s} ${-14 * s} 0z`} fill={HAIR} />
      {cap && <path d={`M${hx - 8 * s} ${hy - 2 * s} a${8 * s} ${6 * s} 0 0 1 ${16 * s} 0z`} fill={cap} />}
      <circle cx={hx + 2.6 * s} cy={hy + 0.5 * s} r={0.9 * s} fill="#1B1B1B" />
    </g>
  );
}

// Each picture needs its own gradient id: many are on one page, and an id
// used twice makes every one of them take the first one's colours.
function Sky({ c1 = "#DDEFFC", c2 = "#F6FBFF", ground = "#E9DCC4" }) {
  const id = "sky" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} />
      </linearGradient>
    </defs>
    <rect width="160" height="100" fill={`url(#${id})`} />
    <rect y="80" width="160" height="20" fill={ground} />
  </>
  );
}

// ------------------------------------------------------------ scenes
const SCENES = {
  auto: () => (
    <>
      <Sky ground="#8C8F94" />
      <rect y="88" width="160" height="2" fill="#F4F4F4" opacity=".7" />
      {/* canopy */}
      <path d="M40 30 Q44 20 64 20 L112 20 Q122 20 122 32 L122 70 L40 70 Z" fill="#1E1E1E" />
      {/* body: green lower, yellow upper */}
      <path d="M34 58 Q34 44 48 42 L120 42 Q128 42 128 52 L128 76 L34 76 Z" fill="#F5C518" />
      <path d="M34 66 L128 66 L128 78 Q128 82 124 82 L38 82 Q34 82 34 78 Z" fill="#1E8B3E" />
      {/* windscreen and driver */}
      <path d="M40 34 Q44 28 54 28 L66 28 L66 52 L38 52 Z" fill="#BFE3F5" opacity=".9" />
      <circle cx="56" cy="38" r="5.5" fill={SKIN} />
      <path d="M50.5 37 a5.5 5.5 0 0 1 11 0 q-5.5 -3 -11 0z" fill={HAIR} />
      <rect x="51" y="43" width="11" height="10" rx="3" fill="#E4E4E4" />
      <line x1="46" y1="50" x2="54" y2="47" stroke="#333" strokeWidth="2" strokeLinecap="round" />
      {/* passenger seat window */}
      <rect x="74" y="28" width="40" height="22" rx="3" fill="#2B2B2B" />
      <rect x="78" y="44" width="32" height="8" rx="2" fill="#7A3B20" />
      {/* headlight */}
      <circle cx="36" cy="60" r="3" fill="#FFF6C8" stroke="#888" />
      {/* wheels */}
      <circle cx="46" cy="84" r="8" fill="#222" /><circle cx="46" cy="84" r="3.2" fill="#AAA" />
      <circle cx="112" cy="84" r="8" fill="#222" /><circle cx="112" cy="84" r="3.2" fill="#AAA" />
    </>
  ),

  driver: () => (
    <>
      <Sky ground="#8C8F94" />
      <path d="M22 66 Q26 50 42 48 L58 36 Q64 32 74 32 L104 32 Q114 32 120 40 L130 50 Q142 52 142 64 L142 76 L22 76 Z" fill="#F2F4F7" stroke="#B9C0C9" />
      <path d="M62 38 L76 36 L76 50 L52 50 Z" fill="#BFE3F5" />
      <path d="M80 36 L102 36 Q108 36 114 44 L118 50 L80 50 Z" fill="#BFE3F5" />
      <circle cx="68" cy="42" r="4.5" fill={SKIN} />
      <path d="M63.5 41 a4.5 4.5 0 0 1 9 0 q-4.5 -2.4 -9 0z" fill={HAIR} />
      <rect x="22" y="62" width="120" height="4" fill="#F5C518" />
      <circle cx="48" cy="78" r="9" fill="#222" /><circle cx="48" cy="78" r="3.5" fill="#AAA" />
      <circle cx="118" cy="78" r="9" fill="#222" /><circle cx="118" cy="78" r="3.5" fill="#AAA" />
    </>
  ),

  glass: () => (
    <>
      <rect width="160" height="100" fill="#EEF3F7" />
      <rect y="84" width="160" height="16" fill="#D9DEE3" />
      {/* aluminium window: silver frame, two sliding panes */}
      <rect x="26" y="12" width="84" height="72" rx="2" fill="#C9D1D9" stroke="#8E99A4" strokeWidth="2" />
      <rect x="31" y="17" width="36" height="62" fill="#9FD3EE" stroke="#A9B3BD" strokeWidth="3" />
      <rect x="69" y="17" width="36" height="62" fill="#B6E0F4" stroke="#A9B3BD" strokeWidth="3" />
      <path d="M36 24 L50 24 L38 44 Z" fill="#fff" opacity=".7" />
      <path d="M74 30 L86 30 L76 48 Z" fill="#fff" opacity=".7" />
      <rect x="64" y="44" width="3" height="10" rx="1" fill="#6E7883" />
      {/* a sheet of glass leaning on the side */}
      <path d="M118 30 L140 26 L146 84 L124 86 Z" fill="#A8DCF2" opacity=".85" stroke="#7FB9D6" />
      <path d="M124 36 L132 35 L128 50 Z" fill="#fff" opacity=".8" />
      {/* aluminium sections */}
      <rect x="112" y="88" width="42" height="3" fill="#B7C0C9" />
      <rect x="112" y="93" width="42" height="3" fill="#A3ADB7" />
    </>
  ),

  pipes: () => (
    <>
      <Sky />
      {/* the black roof tank on its stand */}
      <rect x="40" y="58" width="56" height="4" fill="#8A6D4B" />
      <rect x="44" y="62" width="4" height="20" fill="#8A6D4B" /><rect x="88" y="62" width="4" height="20" fill="#8A6D4B" />
      <path d="M44 28 Q44 20 68 20 Q92 20 92 28 L92 56 Q92 58 68 58 Q44 58 44 56 Z" fill="#1F2327" />
      <ellipse cx="68" cy="21" rx="14" ry="3.5" fill="#3A4046" />
      {[30, 38, 46].map((y) => <rect key={y} x="44" y={y} width="48" height="1.5" fill="#3A4046" />)}
      {/* pipes coming off it */}
      <path d="M92 50 L118 50 L118 84" fill="none" stroke="#E7E9EC" strokeWidth="6" />
      <path d="M92 50 L118 50 L118 84" fill="none" stroke="#B9BEC5" strokeWidth="1" />
      <rect x="112" y="46" width="10" height="8" rx="2" fill="#2F6FB5" />
      <path d="M44 44 L24 44 L24 84" fill="none" stroke="#3A7F3A" strokeWidth="6" />
      {/* stacked pipes on the ground */}
      {[0, 1, 2].map((i) => <rect key={i} x="126" y={74 + i * 7} width="30" height="6" rx="3" fill={["#F0F2F4", "#E5E8EB", "#DADFE3"][i]} stroke="#AEB4BB" />)}
    </>
  ),

  roof: () => (
    <>
      <Sky />
      {/* a house under a corrugated tin roof */}
      <rect x="22" y="48" width="78" height="34" fill="#F1DDB8" />
      <rect x="54" y="60" width="16" height="22" fill="#8A5A34" />
      <rect x="30" y="56" width="16" height="12" fill="#9FD3EE" stroke="#8A5A34" strokeWidth="2" />
      <path d="M14 50 L60 20 L108 50 Z" fill="#AFB8C1" />
      {Array.from({ length: 12 }).map((_, i) => (
        <path key={i} d={`M${60} 20 L${16 + i * 8} 50`} stroke="#8C959F" strokeWidth="1.3" />
      ))}
      {/* stack of sheets */}
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M112 ${80 - i * 5} q4 -3 8 0 t8 0 t8 0 t8 0 t8 0 l0 4 l-40 0z`}
              fill={i % 2 ? "#B9C2CB" : "#A3ADB7"} />
      ))}
    </>
  ),

  mason: () => (
    <>
      <Sky />
      {/* half-built brick wall */}
      {[0, 1, 2, 3, 4].map((r) =>
        Array.from({ length: r > 2 ? 3 : 5 }).map((_, c) => (
          <rect key={`${r}-${c}`} x={70 + c * 17 + (r % 2 ? 8 : 0)} y={72 - r * 9} width="16" height="8"
                fill="#C0512F" stroke="#E9D9C6" strokeWidth="1" />
        )))}
      <Person x={42} y={82} shirt="#E07B24" pants="#3C4C66" ax={62} ay={50} cap="#F5C518" />
      {/* trowel */}
      <path d="M62 50 L70 46 L72 52 Z" fill="#9AA3AD" />
      {/* cement pan */}
      <ellipse cx="20" cy="82" rx="12" ry="4" fill="#6E747B" />
      <ellipse cx="20" cy="80" rx="10" ry="3" fill="#A9ADB2" />
    </>
  ),

  carpenter: () => (
    <>
      <Sky c1="#F7EBDD" c2="#FFF8EF" ground="#D8C3A5" />
      {/* plank on a trestle */}
      <rect x="62" y="56" width="86" height="7" rx="1" fill="#C98A4B" />
      <path d="M82 63 L74 84 M82 63 L90 84 M130 63 L122 84 M130 63 L138 84" stroke="#8A5A34" strokeWidth="3" />
      <Person x={42} y={84} shirt="#2F8A6E" pants="#4A3B30" ax={70} ay={50} />
      {/* saw */}
      <path d="M68 46 L96 58 L94 62 L66 50 Z" fill="#C7CDD3" />
      <rect x="62" y="44" width="8" height="6" rx="2" fill="#8A3D1E" />
      <path d="M100 52 l2 -4 M106 54 l3 -3" stroke="#C98A4B" strokeWidth="2" />
    </>
  ),

  electrician: () => (
    <>
      <Sky />
      {/* pole and wires */}
      <rect x="112" y="10" width="6" height="74" fill="#7A6A58" />
      <rect x="100" y="16" width="30" height="4" fill="#5E5143" />
      <path d="M0 22 Q56 32 102 18 M130 18 Q146 22 160 20" stroke="#222" strokeWidth="1.5" fill="none" />
      {/* ladder */}
      <path d="M86 84 L106 22 M96 84 L116 22" stroke="#C2A15A" strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={89 + i * 3.6} y1={76 - i * 11} x2={99 + i * 3.6} y2={76 - i * 11} stroke="#C2A15A" strokeWidth="2.5" />)}
      <Person x={70} y={84} shirt="#2F6FB5" pants="#39404A" ax={88} ay={56} cap="#F5C518" />
      {/* bulb and switchboard */}
      <rect x="18" y="44" width="22" height="16" rx="2" fill="#fff" stroke="#AEB4BB" />
      <rect x="22" y="48" width="5" height="8" rx="1" fill="#CFD5DB" /><rect x="31" y="48" width="5" height="8" rx="1" fill="#CFD5DB" />
      <circle cx="29" cy="28" r="7" fill="#FFE27A" />
      <rect x="26" y="34" width="6" height="4" fill="#9AA3AD" />
      <path d="M29 14 v-4 M40 20 l3 -3 M18 20 l-3 -3" stroke="#F5B400" strokeWidth="2" strokeLinecap="round" />
    </>
  ),

  plumber: () => (
    <>
      <rect width="160" height="100" fill="#EAF4F8" />
      <rect y="82" width="160" height="18" fill="#CFE0E7" />
      {/* basin and pipes */}
      <path d="M86 40 L140 40 Q138 56 113 56 Q88 56 86 40 Z" fill="#fff" stroke="#AEB4BB" />
      <path d="M110 26 L110 34 L118 34" stroke="#9AA3AD" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M113 56 L113 66 Q113 72 106 72 L96 72" stroke="#C7CDD3" strokeWidth="6" fill="none" />
      <circle cx="96" cy="72" r="4" fill="#9AA3AD" />
      <path d="M118 36 q2 6 0 10" stroke="#4FB3E8" strokeWidth="2" fill="none" />
      <Person x={60} y={84} shirt="#2F6FB5" pants="#1F3A60" ax={90} ay={70} cap="#E03A3A" />
      {/* wrench */}
      <path d="M86 68 L96 72" stroke="#6E7883" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="97" cy="72.5" r="3" fill="none" stroke="#6E7883" strokeWidth="2" />
    </>
  ),

  painter: () => (
    <>
      <rect width="160" height="100" fill="#F4F1EA" />
      <rect x="0" y="0" width="92" height="84" fill="#7FC8A9" />
      <rect y="84" width="160" height="16" fill="#D8CDBA" />
      <Person x={112} y={86} shirt="#F2F2F2" pants="#5B6470" ax={94} ay={40} cap="#E07B24" />
      {/* roller */}
      <line x1="94" y1="40" x2="92" y2="26" stroke="#6E7883" strokeWidth="2" />
      <rect x="84" y="18" width="16" height="8" rx="3" fill="#2F9E7A" />
      {/* bucket */}
      <path d="M130 70 L146 70 L144 86 L132 86 Z" fill="#3A7FC1" />
      <ellipse cx="138" cy="70" rx="8" ry="2" fill="#2F9E7A" />
    </>
  ),

  paints: () => (
    <>
      <rect width="160" height="100" fill="#FBF6EE" />
      <rect y="84" width="160" height="16" fill="#E6DCCB" />
      {[["#E0413A", 14], ["#F5B400", 50], ["#2F6FB5", 86], ["#2F9E7A", 122]].map(([c, x], i) => (
        <g key={i}>
          <path d={`M${x} ${40 + (i % 2) * 6} L${x + 26} ${40 + (i % 2) * 6} L${x + 24} 84 L${x + 2} 84 Z`} fill="#E8EBEE" stroke="#AEB4BB" />
          <rect x={x + 3} y={54 + (i % 2) * 3} width="20" height="14" fill={c} />
          <ellipse cx={x + 13} cy={40 + (i % 2) * 6} rx="13" ry="3" fill={c} />
        </g>
      ))}
      <path d="M20 24 q20 -12 40 0 t40 0 t40 0" stroke="#E0413A" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".5" />
    </>
  ),

  cement: () => (
    <>
      <Sky c1="#EFEFEF" c2="#FAFAFA" ground="#D6D0C4" />
      {[[24, 64], [62, 64], [100, 64], [43, 44], [81, 44], [62, 24]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="36" height="20" rx="5" fill="#E9E4D8" stroke="#A89F8E" />
          <rect x={x + 6} y={y + 6} width="24" height="8" rx="1" fill="#2F6FB5" />
          <text x={x + 18} y={y + 12.5} fontSize="6" fill="#fff" textAnchor="middle" fontWeight="700">CEMENT</text>
        </g>
      ))}
    </>
  ),

  sand: () => (
    <>
      <Sky />
      <path d="M8 84 Q40 30 76 84 Z" fill="#E3C27A" />
      <path d="M70 84 Q104 40 140 84 Z" fill="#9EA3A8" />
      {Array.from({ length: 22 }).map((_, i) => (
        <circle key={i} cx={84 + (i * 13) % 46} cy={64 + (i * 7) % 18} r="2.2" fill={i % 2 ? "#7D8388" : "#B7BBBF"} />
      ))}
      <path d="M136 40 L120 78" stroke="#8A5A34" strokeWidth="3" />
      <path d="M116 76 L126 80 L120 90 L112 86 Z" fill="#6E7883" />
    </>
  ),

  bricks: () => (
    <>
      <Sky ground="#D9C7AE" />
      {[0, 1, 2, 3, 4, 5].map((r) =>
        Array.from({ length: 6 }).map((_, c) => (
          <rect key={`${r}-${c}`} x={22 + c * 20 + (r % 2 ? 10 : 0)} y={72 - r * 10} width="19" height="9"
                fill={(r + c) % 3 ? "#B9482A" : "#C75A38"} stroke="#8E3520" strokeWidth=".6" />
        )))}
    </>
  ),

  steel: () => (
    <>
      <Sky c1="#E6EAEE" c2="#F7F9FA" ground="#C9CDD2" />
      {Array.from({ length: 9 }).map((_, i) => (
        <g key={i}>
          <line x1="14" y1={50 + i * 3.4} x2="146" y2={40 + i * 3.4} stroke="#5E6670" strokeWidth="2.6" />
          <line x1="14" y1={50 + i * 3.4} x2="146" y2={40 + i * 3.4} stroke="#8A939D" strokeWidth="1" strokeDasharray="2 2" />
        </g>
      ))}
      <rect x="44" y="40" width="6" height="36" rx="2" fill="#C0512F" />
      <rect x="108" y="36" width="6" height="36" rx="2" fill="#C0512F" />
    </>
  ),

  hardware: () => (
    <>
      <rect width="160" height="100" fill="#F3EFE8" />
      <rect x="10" y="14" width="140" height="70" rx="4" fill="#C7A77A" />
      {[30, 52].map((y) => <rect key={y} x="10" y={y} width="140" height="3" fill="#9B7C52" />)}
      {/* hammer */}
      <rect x="26" y="40" width="4" height="30" fill="#8A5A34" transform="rotate(-20 28 55)" />
      <rect x="16" y="36" width="20" height="8" rx="2" fill="#5E6670" transform="rotate(-20 26 40)" />
      {/* screwdriver */}
      <rect x="58" y="58" width="6" height="16" rx="2" fill="#E0413A" />
      <rect x="60" y="40" width="2" height="18" fill="#9AA3AD" />
      {/* spanner */}
      <path d="M84 70 L104 44" stroke="#8A939D" strokeWidth="5" strokeLinecap="round" />
      <circle cx="106" cy="42" r="5" fill="none" stroke="#8A939D" strokeWidth="3" />
      {/* nails */}
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${122 + i * 6} 62 v16`} stroke="#6E7883" strokeWidth="1.6" />)}
      <path d="M118 20 h30 v8 h-30z" fill="#E0413A" />
    </>
  ),

  tiles: () => (
    <>
      <rect width="160" height="100" fill="#F2F4F6" />
      {Array.from({ length: 5 }).map((_, r) =>
        Array.from({ length: 8 }).map((_, c) => (
          <rect key={`${r}-${c}`} x={c * 20 + 1} y={r * 20 + 1} width="18" height="18"
                fill={(r + c) % 2 ? "#E6ECEF" : "#C9D6DC"} />
        )))}
      <path d="M0 0 L60 0 L0 60 Z" fill="#fff" opacity=".35" />
    </>
  ),

  sanitary: () => (
    <>
      <rect width="160" height="100" fill="#EAF4F8" />
      <rect y="82" width="160" height="18" fill="#CFE0E7" />
      <path d="M24 34 L72 34 Q70 50 48 50 Q26 50 24 34 Z" fill="#fff" stroke="#AEB4BB" />
      <rect x="44" y="50" width="8" height="32" fill="#fff" stroke="#AEB4BB" />
      <path d="M46 22 L46 30 L54 30" stroke="#9AA3AD" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* WC */}
      <rect x="104" y="22" width="30" height="26" rx="3" fill="#fff" stroke="#AEB4BB" />
      <path d="M98 52 L140 52 Q138 72 119 72 Q100 72 98 52 Z" fill="#fff" stroke="#AEB4BB" />
      <rect x="112" y="70" width="14" height="12" fill="#fff" stroke="#AEB4BB" />
    </>
  ),

  electrical: () => (
    <>
      <rect width="160" height="100" fill="#FFF8E6" />
      <rect y="84" width="160" height="16" fill="#EFE3C4" />
      {/* wire coil */}
      {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="40" cy="60" rx={22 - i * 4} ry={16 - i * 3} fill="none" stroke="#E0413A" strokeWidth="3" />)}
      {/* bulb */}
      <circle cx="90" cy="40" r="12" fill="#FFE27A" />
      <rect x="85" y="51" width="10" height="7" fill="#9AA3AD" />
      <path d="M90 20 v-6 M106 28 l4 -4 M74 28 l-4 -4" stroke="#F5B400" strokeWidth="2" strokeLinecap="round" />
      {/* switch plate */}
      <rect x="116" y="42" width="30" height="38" rx="3" fill="#fff" stroke="#AEB4BB" />
      <rect x="123" y="50" width="7" height="12" rx="1" fill="#CFD5DB" /><rect x="133" y="50" width="7" height="12" rx="1" fill="#CFD5DB" />
      <circle cx="131" cy="71" r="3" fill="#AEB4BB" />
    </>
  ),

  plywood: () => (
    <>
      <rect width="160" height="100" fill="#F6EEE2" />
      <rect y="86" width="160" height="14" fill="#E3D3BC" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={14 + i * 4} y={20 + i * 4} width="70" height="66 " fill={["#D9A66B", "#CF9A5E", "#C68E52", "#BD8447"][i]} stroke="#9C6B3A" strokeWidth=".6" />
      ))}
      {/* door */}
      <rect x="100" y="14" width="42" height="72" rx="2" fill="#8A5A34" />
      <rect x="106" y="20" width="30" height="26" rx="1" fill="#9D6A40" />
      <rect x="106" y="52" width="30" height="28" rx="1" fill="#9D6A40" />
      <circle cx="134" cy="50" r="2" fill="#E3C27A" />
    </>
  ),

  welder: () => (
    <>
      <rect width="160" height="100" fill="#2B2F36" />
      <rect y="82" width="160" height="18" fill="#3C424B" />
      <rect x="84" y="62" width="60" height="6" fill="#6E7883" />
      <Person x={60} y={84} shirt="#3A6FA0" pants="#2C3440" ax={86} ay={60} />
      <rect x="53" y="36" width="15" height="12" rx="3" fill="#1B1E22" />
      <rect x="56" y="40" width="9" height="3" fill="#6CE0FF" />
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={i} x1="90" y1="62" x2={90 + Math.cos(i) * 16} y2={62 - Math.abs(Math.sin(i)) * 16}
              stroke={i % 2 ? "#FFD35A" : "#FF9F2E"} strokeWidth="1.6" strokeLinecap="round" />
      ))}
      <circle cx="90" cy="62" r="4" fill="#FFF3B0" />
    </>
  ),

  mechanic: () => (
    <>
      <Sky ground="#A9ADB2" />
      {/* motorbike */}
      <circle cx="98" cy="74" r="12" fill="#222" /><circle cx="98" cy="74" r="4" fill="#AAA" />
      <circle cx="144" cy="74" r="12" fill="#222" /><circle cx="144" cy="74" r="4" fill="#AAA" />
      <path d="M98 74 L114 54 L136 54 L144 74 M114 54 L122 64 L136 54" stroke="#C0392B" strokeWidth="5" fill="none" strokeLinejoin="round" />
      <rect x="112" y="48" width="20" height="6" rx="3" fill="#222" />
      <Person x={60} y={86} shirt="#39506E" pants="#39506E" ax={90} ay={70} />
      <path d="M86 70 L96 64" stroke="#8A939D" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),

  tailor: () => (
    <>
      <rect width="160" height="100" fill="#FBF1F4" />
      <rect y="78" width="160" height="22" fill="#C9A27E" />
      {/* sewing machine */}
      <path d="M60 36 L112 36 Q120 36 120 44 L120 72 L106 72 L106 50 L70 50 L70 58 L60 58 Z" fill="#1F2327" />
      <rect x="54" y="72" width="76" height="6" rx="2" fill="#3A4046" />
      <circle cx="118" cy="50" r="6" fill="#C7CDD3" />
      <rect x="64" y="58" width="3" height="10" fill="#C7CDD3" />
      {/* cloth */}
      <path d="M20 70 L72 64 L80 78 L24 80 Z" fill="#E0413A" />
      <path d="M26 72 L70 67" stroke="#fff" strokeDasharray="3 2" />
      {/* thread spools */}
      <rect x="136" y="56" width="8" height="16" rx="2" fill="#2F6FB5" />
      <rect x="146" y="60" width="8" height="12" rx="2" fill="#F5B400" />
    </>
  ),

  cook: () => (
    <>
      <rect width="160" height="100" fill="#FDF3EC" />
      <rect y="70" width="160" height="30" fill="#8A5A34" />
      {/* stove and pot */}
      <rect x="84" y="62" width="56" height="8" fill="#3A4046" />
      <path d="M92 62 q4 -6 8 0 M112 62 q4 -6 8 0" stroke="#FF8A2E" strokeWidth="2" fill="none" />
      <rect x="92" y="40" width="36" height="22" rx="4" fill="#9AA3AD" />
      <rect x="88" y="38" width="44" height="5" rx="2" fill="#7B858F" />
      <path d="M100 30 q3 -5 0 -10 M110 30 q3 -5 0 -10 M120 30 q3 -5 0 -10" stroke="#C7CDD3" strokeWidth="2" fill="none" />
      <Person x={50} y={86} shirt="#FFFFFF" pants="#39404A" ax={80} ay={52} />
      <path d="M43 44 Q40 30 50 32 Q60 30 57 44 Z" fill="#fff" stroke="#DADFE3" />
      <path d="M80 52 L96 42" stroke="#8A5A34" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),

  events: () => (
    <>
      <rect width="160" height="100" fill="#2A1F3D" />
      <rect y="80" width="160" height="20" fill="#5B3A6E" />
      {/* a shamiana with string lights */}
      <path d="M16 40 L80 14 L144 40 Z" fill="#E0413A" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path key={i} d={`M${16 + i * 16} 40 q8 8 16 0`} fill={i % 2 ? "#F5C518" : "#FFFFFF"} />
      ))}
      <rect x="20" y="40" width="4" height="42" fill="#C7A77A" /><rect x="136" y="40" width="4" height="42" fill="#C7A77A" />
      <path d="M24 50 Q80 64 136 50" stroke="#F5C518" strokeWidth="1" fill="none" />
      {Array.from({ length: 11 }).map((_, i) => (
        <circle key={i} cx={28 + i * 10.4} cy={51 + Math.sin((i / 10) * Math.PI) * 6.5} r="2" fill={["#FFE27A", "#FF8A8A", "#8AE0FF"][i % 3]} />
      ))}
      {/* marigold garlands */}
      {[40, 80, 120].map((x) => <line key={x} x1={x} y1="42" x2={x} y2="74" stroke="#F59E0B" strokeWidth="3" strokeDasharray="3 1" />)}
    </>
  ),

  maid: () => (
    <>
      <rect width="160" height="100" fill="#F3EEF9" />
      <rect y="82" width="160" height="18" fill="#D9CDEB" />
      <Person x={70} y={84} shirt="#A04FC2" pants="#6A3485" ax={92} ay={60} />
      {/* broom */}
      <line x1="92" y1="46" x2="104" y2="80" stroke="#8A5A34" strokeWidth="3" />
      <path d="M98 76 L112 76 L118 88 L96 88 Z" fill="#E3C27A" />
      {/* bucket */}
      <path d="M22 68 L42 68 L40 86 L24 86 Z" fill="#2F6FB5" />
      <path d="M22 68 Q32 58 42 68" stroke="#2F6FB5" strokeWidth="1.5" fill="none" />
      {/* sparkle on the clean floor */}
      <path d="M128 72 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2z" fill="#fff" />
    </>
  ),
};

// A picture for each category, from one of its trades.
const GROUP_PICTURE = {
  "Construction": "mason", "Drivers": "auto", "Home & Domestic": "maid", "Food": "cook",
  "Repairs": "electrician", "Vehicle": "mechanic", "Events": "events", "Suppliers": "hardware",
};
export function GroupPicture({ group, fallback = null, style }) {
  const key = GROUP_PICTURE[group];
  return key ? <Picture pkey={key} fallback={fallback} style={style} /> : fallback;
}

function Picture({ pkey, fallback, style }) {
  const photo = pkey && photoFor(pkey);
  const box = { display: "block", width: "100%", height: "100%", ...style };
  if (photo) return <img src={photo} alt="" loading="lazy" style={{ ...box, objectFit: "cover" }} />;
  const Scene = pkey && SCENES[pkey];
  if (!Scene) return fallback;
  return (
    <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" style={box} aria-hidden="true">
      <Scene />
    </svg>
  );
}

// The picture, filling its box. Falls back to `fallback` (the group icon)
// when the trade has no picture.
export function TradePicture({ trade, fallback = null, style }) {
  return <Picture pkey={pictureKey(trade)} fallback={fallback} style={style} />;
}
