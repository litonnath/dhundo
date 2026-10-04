// ---------------------------------------------------------------------------
// SCENE PICTURES for the front tiles: a person riding pillion, a food
// scooter on the move, a worker at a wall, a shop front. Drawn as SVG so the
// app needs no image download and works offline.
//
// To use real photographs instead, put files named worker.jpg, ride.jpg,
// shop.jpg, eat.jpg, market.jpg and partner.jpg in public/tiles/. A photo
// that loads is shown over the drawing; a missing one changes nothing.
// ---------------------------------------------------------------------------
import React, { useState } from "react";

const SKIN = "#D9A06F", SKIN2 = "#B9784A", INK = "#111827";

const Wheel = ({ x, y, r = 17 }) => (
  <g><circle cx={x} cy={y} r={r} fill={INK} /><circle cx={x} cy={y} r={r * 0.55} fill="#9CA3AF" /><circle cx={x} cy={y} r={r * 0.18} fill={INK} /></g>
);
const Road = ({ c = "#4B5563" }) => (
  <g><rect x="0" y="146" width="320" height="34" fill={c} />
    <path d="M0 164h320" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="16 14" opacity="0.7" /></g>
);
const Speed = ({ y = 100 }) => (
  <g stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.75">
    <path d={`M18 ${y}h44`} /><path d={`M6 ${y + 14}h40`} /><path d={`M24 ${y + 28}h36`} /></g>
);

const SCENES = {
  need: (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill="#E3EEFF" />
      <g stroke="#C9DBF7" strokeWidth="2"><path d="M0 40h320M0 90h320M0 140h320M60 0v180M150 0v180M250 0v180" /></g>
      <path d="M20 160 Q90 110 160 120 T300 60" stroke="#93B4EA" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="2 12" />
      {[[70,50],[250,110]].map(([x,y],i)=>(<g key={i}><path d={`M${x} ${y+22}s-14-14-14-26a14 14 0 1 1 28 0c0 12-14 26-14 26z`} fill="#EF4444" /><circle cx={x} cy={y-4} r="5" fill="#fff" /></g>))}
      <rect x="0" y="152" width="320" height="28" fill="#CFE0F8" />
      <rect x="122" y="104" width="50" height="50" rx="12" fill="#1D4ED8" /><circle cx="147" cy="86" r="14" fill={SKIN} /><path d="M133 84a14 14 0 0 1 28 0c-6-6-22-6-28 0z" fill={INK} />
      <path d="M164 118 L192 96" stroke="#1D4ED8" strokeWidth="9" strokeLinecap="round" />
      <rect x="184" y="52" width="46" height="66" rx="8" fill="#111827" /><rect x="188" y="58" width="38" height="54" rx="4" fill="#fff" />
      <rect x="192" y="64" width="30" height="9" rx="3" fill="#BFDBFE" /><rect x="192" y="77" width="30" height="9" rx="3" fill="#BBF7D0" /><rect x="192" y="90" width="30" height="9" rx="3" fill="#FDE68A" /><circle cx="207" cy="106" r="3" fill="#2563EB" />
    </svg>
  ),
  offer: (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill="#FFEFD9" />
      <rect x="0" y="152" width="320" height="28" fill="#EBCFA6" />
      <rect x="50" y="46" width="130" height="14" fill="#EA580C" />
      {[0,1,2,3].map((i)=>(<path key={i} d={`M${50+i*32.5} 60h32.5v6a16 11 0 0 1 -32.5 0z`} fill={i%2?"#fff":"#F97316"} />))}
      <rect x="56" y="92" width="118" height="14" rx="4" fill="#92400E" /><rect x="62" y="106" width="106" height="46" fill="#B45309" />
      <rect x="150" y="68" width="22" height="24" rx="3" fill="#FDE68A" /><rect x="78" y="78" width="30" height="14" rx="3" fill="#F59E0B" />
      <rect x="104" y="62" width="40" height="22" rx="4" fill="#fff" stroke="#EA580C" strokeWidth="2" />
      <text x="124" y="78" fontSize="13" fontWeight="800" fill="#EA580C" textAnchor="middle" fontFamily="sans-serif">OPEN</text>
      <rect x="206" y="108" width="46" height="46" rx="12" fill="#16A34A" /><circle cx="229" cy="90" r="14" fill={SKIN2} /><path d="M215 90a14 14 0 0 1 28 0z" fill="#451A03" />
      <path d="M208 120 L190 104" stroke="#16A34A" strokeWidth="9" strokeLinecap="round" />
      <circle cx="278" cy="60" r="16" fill="#16A34A" /><text x="278" y="66" fontSize="17" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="sans-serif">₹</text>
      <circle cx="292" cy="98" r="9" fill="#F59E0B" opacity="0.9" />
    </svg>
  ),
  ride: (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="sk1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#BFD9FF" /><stop offset="1" stopColor="#EAF3FF" /></linearGradient></defs>
      <rect width="320" height="180" fill="url(#sk1)" />
      <g fill="#C7D7EE"><rect x="190" y="70" width="40" height="76" /><rect x="236" y="50" width="34" height="96" /><rect x="276" y="84" width="44" height="62" /><rect x="20" y="86" width="46" height="60" /><rect x="70" y="64" width="30" height="82" /></g>
      <Road /><Speed y={96} />
      <Wheel x={108} y={144} /><Wheel x={214} y={144} />
      <path d="M106 130 L126 106 L192 106 L208 122 L204 136 L142 136 Z" fill="#2563EB" />
      <rect x="118" y="98" width="62" height="9" rx="4" fill={INK} />
      <path d="M204 122 L214 144" stroke={INK} strokeWidth="4" />
      <path d="M208 90 L202 110" stroke={INK} strokeWidth="4" strokeLinecap="round" /><circle cx="212" cy="96" r="4" fill="#FDE68A" />
      {/* passenger, sitting behind */}
      <path d="M132 104 L156 122 L150 144" stroke="#1E293B" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M124 104 L128 68 L150 68 L150 104 Z" fill="#F97316" />
      <circle cx="140" cy="57" r="10" fill={SKIN2} /><path d="M129 56a11 11 0 0 1 22 0c-4-5-16-6-22 0z" fill={INK} />
      <path d="M146 78 L168 88" stroke="#F97316" strokeWidth="7" strokeLinecap="round" />
      {/* rider */}
      <path d="M166 104 L190 120 L186 144" stroke="#1E293B" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M160 104 L168 68 L188 68 L184 104 Z" fill="#0F172A" />
      <circle cx="182" cy="56" r="10" fill={SKIN} /><path d="M171 55a11 11 0 0 1 22 0z" fill="#FACC15" /><rect x="190" y="54" width="5" height="4" rx="2" fill="#FACC15" />
      <path d="M184 76 L208 90" stroke="#0F172A" strokeWidth="7" strokeLinecap="round" />
    </svg>
  ),
  eat: (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="sk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE2B8" /><stop offset="1" stopColor="#FFF3DE" /></linearGradient></defs>
      <rect width="320" height="180" fill="url(#sk2)" />
      <g fill="#F5D9AE"><rect x="200" y="76" width="36" height="70" /><rect x="244" y="56" width="40" height="90" /><rect x="30" y="90" width="44" height="56" /></g>
      <Road c="#57534E" /><Speed y={92} />
      <Wheel x={112} y={144} r={15} /><Wheel x={222} y={144} r={15} />
      <path d="M116 130 Q116 110 144 110 L212 110 L212 136 L118 136 Z" fill="#DC2626" />
      <path d="M208 76 L220 74 L230 134 L212 134 Z" fill="#B91C1C" />
      <rect x="130" y="100" width="56" height="9" rx="4" fill="#450A0A" />
      {/* the food box on the back */}
      <rect x="62" y="64" width="68" height="52" rx="8" fill="#F97316" />
      <rect x="62" y="64" width="68" height="12" rx="6" fill="#EA580C" />
      <path d="M80 100h32a16 16 0 0 1-32 0z" fill="#fff" /><path d="M88 94c0-5 4-5 4-10M100 94c0-5 4-5 4-10" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* rider */}
      <path d="M170 106 L198 122 L194 144" stroke="#1E3A8A" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M150 106 L160 66 L184 66 L186 106 Z" fill="#16A34A" />
      <circle cx="176" cy="54" r="10" fill={SKIN} /><path d="M164 53a12 12 0 0 1 24 0z" fill="#DC2626" /><rect x="186" y="52" width="6" height="4" rx="2" fill="#DC2626" />
      <path d="M180 76 L214 84" stroke="#16A34A" strokeWidth="7" strokeLinecap="round" />
    </svg>
  ),
  worker: (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill="#FFEBD6" />
      <g fill="#E8A67A">{[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2, 3].map((c) => (
        <rect key={r + "-" + c} x={186 + c * 34 - (r % 2) * 17} y={14 + r * 20} width="31" height="17" rx="2" />)))}</g>
      <rect x="0" y="150" width="320" height="30" fill="#D6C2A8" />
      <rect x="40" y="132" width="50" height="22" rx="4" fill="#B45309" /><rect x="40" y="132" width="50" height="6" fill="#92400E" /><rect x="60" y="128" width="10" height="6" rx="2" fill="#78350F" />
      {/* worker */}
      <rect x="124" y="108" width="14" height="46" rx="4" fill="#1E3A8A" /><rect x="142" y="108" width="14" height="46" rx="4" fill="#1E3A8A" />
      <rect x="120" y="150" width="20" height="8" rx="3" fill={INK} /><rect x="142" y="150" width="20" height="8" rx="3" fill={INK} />
      <path d="M116 66 L164 66 L160 112 L120 112 Z" fill="#2563EB" />
      <path d="M126 66 L154 66 L152 112 L128 112 Z" fill="#F97316" /><rect x="127" y="92" width="26" height="4" fill="#FEF08A" />
      <circle cx="140" cy="50" r="13" fill={SKIN} />
      <path d="M125 48a15 15 0 0 1 30 0z" fill="#FEF3C7" /><rect x="122" y="46" width="36" height="5" rx="2.5" fill="#FCD34D" />
      <path d="M164 74 L192 60" stroke="#2563EB" strokeWidth="9" strokeLinecap="round" />
      <path d="M118 74 L104 100" stroke="#2563EB" strokeWidth="9" strokeLinecap="round" />
      <path d="M192 60 L204 36" stroke="#6B7280" strokeWidth="5" strokeLinecap="round" /><circle cx="206" cy="32" r="8" fill="none" stroke="#6B7280" strokeWidth="5" />
    </svg>
  ),
  shop: (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill="#E3F4E8" />
      <rect x="0" y="150" width="320" height="30" fill="#CBD5C0" />
      <rect x="48" y="52" width="224" height="100" fill="#fff" />
      <rect x="48" y="52" width="224" height="14" fill="#15803D" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M${48 + i * 32} 66 h32 v6 a16 12 0 0 1 -32 0z`} fill={i % 2 ? "#fff" : "#22C55E"} stroke="#DCFCE7" />))}
      <rect x="64" y="92" width="100" height="60" fill="#F1F5F9" /><rect x="64" y="92" width="100" height="60" fill="none" stroke="#CBD5E1" strokeWidth="3" />
      <path d="M64 112h100M64 132h100" stroke="#CBD5E1" strokeWidth="3" />
      <rect x="72" y="98" width="18" height="14" fill="#F59E0B" /><rect x="94" y="100" width="14" height="12" fill="#3B82F6" /><rect x="112" y="96" width="20" height="16" fill="#EF4444" /><rect x="136" y="100" width="18" height="12" fill="#A855F7" />
      <rect x="72" y="118" width="24" height="14" fill="#10B981" /><rect x="100" y="120" width="16" height="12" fill="#F97316" /><rect x="122" y="116" width="26" height="16" fill="#0EA5E9" />
      <rect x="180" y="86" width="64" height="66" fill="#8B5E3C" /><rect x="186" y="92" width="52" height="60" fill="#A97A50" /><circle cx="230" cy="124" r="3" fill="#FDE68A" />
      <rect x="254" y="130" width="22" height="22" rx="3" fill="#B45309" /><rect x="244" y="138" width="20" height="14" rx="3" fill="#D97706" />
    </svg>
  ),
  market: (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill="#F1E4FB" />
      <rect x="0" y="150" width="320" height="30" fill="#D9C8EA" />
      <path d="M52 150v-34h86v34M52 116v-26h14v26M138 116v-26h-14v26" fill="none" stroke="#7C3F1D" strokeWidth="9" strokeLinejoin="round" />
      <rect x="50" y="104" width="90" height="16" rx="5" fill="#B45309" />
      <rect x="48" y="86" width="94" height="22" rx="8" fill="#D97706" />
      <rect x="172" y="60" width="52" height="90" rx="9" fill="#1F2937" /><rect x="177" y="68" width="42" height="72" rx="4" fill="#93C5FD" />
      <circle cx="198" cy="104" r="14" fill="#fff" opacity="0.85" /><path d="M192 104l5 5 9-10" stroke="#16A34A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M244 40 L244 60" stroke="#6B7280" strokeWidth="2" />
      <path d="M232 62h48l10 14-10 14h-48z" fill="#A855F7" /><circle cx="240" cy="76" r="3.5" fill="#F1E4FB" />
      <text x="262" y="82" fontSize="18" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="sans-serif">₹</text>
    </svg>
  ),
  partner: (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill="#DDF3F0" />
      <rect x="0" y="150" width="320" height="30" fill="#BFE3DE" />
      <path d="M118 78 Q160 28 204 78" stroke="#0F766E" strokeWidth="3" fill="none" strokeDasharray="6 6" />
      <circle cx="160" cy="46" r="15" fill="#14B8A6" /><text x="160" y="52" fontSize="16" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="sans-serif">₹</text>
      <rect x="84" y="92" width="60" height="58" rx="14" fill="#0F766E" /><circle cx="114" cy="74" r="15" fill={SKIN} /><path d="M99 72a15 15 0 0 1 30 0c-6-6-24-6-30 0z" fill={INK} />
      <rect x="176" y="92" width="60" height="58" rx="14" fill="#F59E0B" /><circle cx="206" cy="74" r="15" fill={SKIN2} /><path d="M191 74a15 15 0 0 1 30 0z" fill="#451A03" />
      <rect x="130" y="104" width="16" height="26" rx="3" fill={INK} transform="rotate(-18 138 117)" /><rect x="132" y="107" width="12" height="19" rx="2" fill="#93C5FD" transform="rotate(-18 138 117)" />
    </svg>
  ),
};

export function TileArt({ k, style }) {
  const [photo, setPhoto] = useState(false);
  return (
    <span style={{ display: "block", position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden", ...style }} aria-hidden="true">
      <span style={{ position: "absolute", inset: 0, display: "block" }}>
        {React.cloneElement(SCENES[k === "sell" ? "market" : k] || SCENES.worker, { width: "100%", height: "100%", style: { display: "block" } })}
      </span>
      <img src={`/tiles/${k}.jpg`} alt="" loading="lazy" onLoad={() => setPhoto(true)} onError={() => setPhoto(false)}
           style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: photo ? "block" : "none" }} />
    </span>
  );
}
