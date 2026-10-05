// ---------------------------------------------------------------------------
// FIRST SCREENS, after the language: "I need something" or "I offer
// something"; and for those who offer, what they offer. Each choice is
// remembered, so these show once.
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from "react";
import { T, Icon, groupStyle, groupLabel, VoiceButton } from "./ui.jsx";
import { useI18n, tradeName } from "./i18n.jsx";
import { TileArt } from "./scenes.jsx";

// Centred both ways: on a wide screen the choices sit in the middle, not in a
// corner, and on a phone they still start at the top when they do not fit.
const shell = {
  position: "fixed", inset: 0, zIndex: 420, overflowY: "auto",
  background: "linear-gradient(160deg, #F4F8FF 0%, #FFFFFF 55%, #FFF7EC 100%)",
  display: "flex", justifyContent: "center", alignItems: "safe center",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
const wrap = { width: "100%", maxWidth: 520, margin: "auto", padding: "28px 18px 34px", boxSizing: "border-box" };

function BigChoice({ icon, bg, fg, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 14, textAlign: "left",
      minHeight: 88, padding: "14px 16px", marginBottom: 12, borderRadius: 18,
      border: `1px solid ${T.line}`, background: T.white, cursor: "pointer", fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(15,20,25,0.05)",
    }}>
      <span style={{
        width: 54, height: 54, borderRadius: 16, background: bg, color: fg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon name={icon} size={28} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 17.5, fontWeight: 800, color: T.ink, lineHeight: 1.25 }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft, lineHeight: 1.45, marginTop: 3 }}>{sub}</span>}
      </span>
      <Icon name="chev" size={20} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
    </button>
  );
}

// Screen 1: who are you today.
export function StartGate({ onNeed, onOffer }) {
  const { t } = useI18n();
  return (
    <div style={shell} role="dialog" aria-modal="true">
      <div style={wrap}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: T.ink, margin: "0 0 22px", lineHeight: 1.25, textAlign: "center" }}>{t("start_title")}</h1>
        <BigChoice icon="search" bg="#E8F1FF" fg="#1D4ED8" title={t("start_need")} sub={t("start_need_sub")} onClick={onNeed} />
        <BigChoice icon="construction" bg="#FFF1E6" fg="#B45309" title={t("start_offer")} sub={t("start_offer_sub")} onClick={onOffer} />
      </div>
    </div>
  );
}

// Screen 2, for people who offer: what kind of business is it.
export function OfferTypeGate({ onPick, onBack, inline = false, trades = [] }) {
  const { t, lang } = useI18n();
  const [type, setType] = useState(null);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 600);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 600);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const types = [
    ["worker", "construction", "#FFF1E6", "#C2410C", "home_worker", "offer_sub_worker"],
    ["ride", "drivers", "#E8F0FE", "#1D4ED8", "home_ride", "offer_sub_ride"],
    ["shop", "suppliers", "#E7F5EC", "#15803D", "home_shop", "offer_sub_shop"],
    ["eat", "food", "#FDF3DC", "#A16207", "home_eat", "offer_sub_eat"],
    ["sell", "tag", "#F3E8FD", "#7E22CE", "offer_sell", "offer_sub_sell"],
  ];
  // Second step, like the Worker screen on the other side: what exactly do you do.
  const picking = type && tradesFor(type, trades).length > 0 ? type : null;
  const step2 = picking && (() => {
    const list = tradesFor(picking, trades);
    const meta = types.find((x) => x[0] === picking);
    const byGroup = [];
    list.forEach((x) => {
      let g = byGroup.find((y) => y.g === x.group_name);
      if (!g) { g = { g: x.group_name, items: [] }; byGroup.push(g); }
      g.items.push({ key: x.slug, label: tradeName(x, lang), icon: tradeIcon(x, groupStyle(x.group_name).icon) });
    });
    return (
      <SubCategories
        art={picking} title={t(meta[4])} sub={t("offer_what")} searchPh={t("st_search")}
        sections={byGroup.map((g) => ({ title: byGroup.length > 1 ? groupLabel(g.g, lang) : null, items: g.items,
                                         icon: groupStyle(g.g).icon, fg: groupStyle(g.g).fg, bg: groupStyle(g.g).bg }))}
        onPick={(slug) => onPick(picking, slug)} />
    );
  })();
  const body = (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: inline ? "26px 16px 120px" : "20px 16px 34px", boxSizing: "border-box" }}>
      <button onClick={() => (picking ? setType(null) : onBack())} style={{
        display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "4px 0",
        color: T.brandDark, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 40, marginBottom: 6,
      }}><Icon name="back" size={16} /> {t("w_back")}</button>
      {step2 || (<>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "0 0 18px", lineHeight: 1.25 }}>{t("offer_title")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? 3 : 2}, 1fr)`, gap: 12 }}>
        {types.map(([key, icon, bg, fg, title, sub]) => (
          <button key={key} onClick={() => (key === "worker" || key === "shop" || key === "eat" ? setType(key) : onPick(key))} style={{
            display: "flex", flexDirection: "column", alignItems: "stretch", textAlign: "left", padding: 0, overflow: "hidden",
            borderRadius: 14, border: `1px solid ${T.line}`, background: T.white, cursor: "pointer", fontFamily: "inherit",
          }}>
            <TileArt k={key} />
            <span style={{ display: "block", padding: "11px 13px 13px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: bg, color: fg, flexShrink: 0,
                               display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} /></span>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{t(title)}</span>
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4, marginTop: 6 }}>{t(sub)}</span>
            </span>
          </button>
        ))}
      </div>
      </>)}
    </div>
  );
  if (inline) return body;
  return <div style={shell} role="dialog" aria-modal="true">{body}</div>;
}


// THE FRONT OF THE APP for somebody who needs something: six plain tiles,
// a line icon on a soft tint, a title and one line under it. Each opens its
// own screen. Deliberately flat -- no gradients, no pictures.
const TILES = [
  ["worker", "construction", "#C2410C", "#FFF1E6", "home_worker", "offer_sub_worker", "worker"],
  ["ride", "drivers", "#1D4ED8", "#E8F0FE", "home_ride", "offer_sub_ride", "need-ride"],
  ["shop", "suppliers", "#15803D", "#E7F5EC", "home_shop", "offer_sub_shop", "shop"],
  ["eat", "food", "#A16207", "#FDF3DC", "home_eat", "offer_sub_eat", "need-eat"],
  ["market", "tag", "#7E22CE", "#F3E8FD", "need_buy", "need_buy_sub", "need-market"],
  ["partner", "user", "#0F766E", "#E3F4F2", "home_partner", "home_partner_sub", "partner"],
];

// The small "back to home" pill at the top of every screen that opens from the front.
export function HomeButton({ onClick, label }) {
  const { t } = useI18n();
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: T.white, border: `1px solid ${T.line}`,
      borderRadius: 20, padding: "7px 14px", minHeight: 40, cursor: "pointer", fontFamily: "inherit",
      fontSize: 14, fontWeight: 700, color: T.brandDark,
    }}><Icon name="back" size={16} /> {label || t("launch_back")}</button>
  );
}

export function CustomerLauncher({ onPick, onOffer, side, setSide }) {
  const { t } = useI18n();
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 600);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 600);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  if (!side) {
    const cards = [
      ["need", "mode_need", "start_need_sub", "search", "#1D4ED8", "#E8F0FE", () => setSide("need")],
      ["offer", "mode_offer", "start_offer_sub", "edit", "#C2410C", "#FFF1E6", onOffer],
    ];
    return (
      <div style={{ minHeight: "calc(100vh - 170px)", display: "flex", flexDirection: "column", justifyContent: "center",
                    padding: "26px 16px 110px", boxSizing: "border-box" }}>
        <div style={{ width: "100%", maxWidth: 820, margin: "0 auto" }}>
          <h1 style={{ fontSize: wide ? 30 : 25, fontWeight: 800, color: T.ink, margin: "0 0 6px", lineHeight: 1.25, textAlign: "center" }}>{t("start_title")}</h1>
          <p style={{ fontSize: 14.5, color: T.inkSoft, margin: "0 0 20px", textAlign: "center" }}>{t("trust_2_s")}</p>
          <div style={{ display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: 16 }}>
            {cards.map(([k, title, sub, icon, fg, bg, go]) => (
              <button key={k} onClick={go} style={{
                display: "block", padding: 0, overflow: "hidden", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                borderRadius: 18, border: `1px solid ${T.line}`, background: T.white, boxShadow: "0 6px 20px rgba(15,20,25,0.07)",
              }}>
                <TileArt k={k} style={{ aspectRatio: wide ? "16 / 9" : "21 / 9" }} />
                <span style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 16px" }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: bg, color: fg, flexShrink: 0,
                                 display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={22} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 19, fontWeight: 800, color: T.ink }}>{t(title)}</span>
                    <span style={{ display: "block", fontSize: 13, color: T.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{t(sub)}</span>
                  </span>
                  <Icon name="chev" size={20} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "26px 16px 120px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <button onClick={() => setSide(null)} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "4px 0",
          color: T.brandDark, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 40, marginBottom: 6,
        }}><Icon name="back" size={16} /> {t("launch_back")}</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "0 0 18px", lineHeight: 1.25 }}>
          {t("launch_title")}
        </h1>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? 3 : 2}, 1fr)`, gap: 12 }}>
          {TILES.map(([key, icon, fg, bg, label, sub, art]) => (
            <button key={key} onClick={() => onPick(key)} style={{
              display: "flex", flexDirection: "column", alignItems: "stretch", textAlign: "left",
              padding: 0, overflow: "hidden", borderRadius: 14, border: `1px solid ${T.line}`, background: T.white,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <TileArt k={art} />
              <span style={{ display: "block", padding: "11px 13px 13px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, color: fg, background: bg, flexShrink: 0,
                                 display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} /></span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{t(label)}</span>
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4, marginTop: 6 }}>{t(sub)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// One line icon per kind of food place or shop, picked from the English name
// (the database holds the trades, not their pictures).
const ICON_RULES = [
  [/tea|snack|chai/, "teacup"], [/bakery|sweet|cake|mithai/, "cake"], [/fast food|biryani|burger|pizza|momo|roll/, "burger"],
  [/dhaba|curry|meal/, "pot"], [/tiffin|home food|lunch/, "tiffin"], [/cater/, "cloche"], [/hotel|lodge|resort/, "bed"],
  [/homestay|guest|house stay|stay/, "home"], [/restaurant|food|canteen|mess/, "cutlery"],
  [/paint/, "roller"], [/cement/, "bag"], [/brick/, "bricks"], [/steel|rod|tmt|iron/, "rods"], [/pipe|tank/, "pipes"],
  [/tile|marble|granite/, "tiles"], [/electric|wire|bulb|light/, "bolt"], [/sanitary|plumbing|bath/, "tap"],
  [/ply|timber|wood|door/, "timber"], [/glass|alumin/, "glass"], [/tin|roof/, "sheets"], [/sand|stone|gravel|chips/, "bricks"],
  [/hardware|tool/, "repairs"],
];
export function tradeIcon(tr, fallback) {
  const k = `${tr.name_en || ""} ${tr.slug || ""}`.toLowerCase();
  const hit = ICON_RULES.find(([re]) => re.test(k));
  return hit ? hit[1] : fallback;
}

// A search box with the microphone, like the one on the Worker screen.
export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "4px 6px 4px 14px", margin: "0 0 14px" }}>
      <Icon name="search" size={19} style={{ color: T.inkFaint }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
             style={{ flex: 1, border: "none", outline: "none", fontSize: 16, minHeight: 44, background: "transparent", fontFamily: "inherit", minWidth: 0 }} />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear" style={{ border: "none", background: "none", cursor: "pointer", color: T.inkFaint, width: 36, height: 44 }}>
          <Icon name="close" size={18} />
        </button>
      )}
      <VoiceButton onHeard={onChange} />
    </div>
  );
}

// Which trades belong to which front tile, so every screen agrees.
const NOT_WORKER = ["Drivers", "Suppliers", "Eat & Stay"];
export function tradesFor(kind, trades) {
  if (kind === "eat") return trades.filter((x) => x.group_name === "Eat & Stay");
  if (kind === "shop") return trades.filter((x) => (x.kind === "supplier" || x.group_name === "Suppliers") && x.group_name !== "Eat & Stay");
  return trades.filter((x) => x.kind !== "supplier" && !NOT_WORKER.includes(x.group_name));
}

// WHAT DO YOU NEED / WHAT DO YOU OFFER, for the app somebody chose: only that
// app's own sub-categories, as plain rows with a line icon (or an emoji for
// the items). No illustrations. Optional banner on top; optional sections.
export function SubCategories({ title, sub, icon, fg, bg, items, sections, onPick, onAll, allLabel, art, searchPh }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const secs = (sections || [{ items }]).map((sc) => ({ ...sc, items: needle ? sc.items.filter((it) => String(it.label).toLowerCase().includes(needle)) : sc.items })).filter((sc) => sc.items.length);
  return (
    <div>
      {art && <TileArt k={art} pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 240, marginBottom: 14 }} />}
      {title && <h2 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "0 0 4px" }}>{title}</h2>}
      {title && <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 14px" }}>{sub || t("what_need")}</p>}
      {searchPh && <SearchBox value={q} onChange={setQ} placeholder={searchPh} />}
      {onAll && !needle && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginBottom: 10 }}>
          <button onClick={onAll} style={tileStyle(T.brandSoft, T.brandDark)}>
            <span style={iconBox(T.white, T.brandDark)}><Icon name="search" size={20} /></span>
            <span style={labelStyle}>{allLabel}</span>
          </button>
        </div>
      )}
      {secs.map((sec, si) => (
        <div key={si} style={{ marginBottom: 14 }}>
          {sec.title && <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, margin: "6px 0 8px", textTransform: "uppercase", letterSpacing: 0.3 }}>{sec.title}</div>}
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {sec.items.map((it) => (
              <button key={it.key} onClick={() => onPick(it.key)} style={tileStyle(T.white, T.line)}>
                <span style={iconBox(sec.bg || bg, sec.fg || fg)}>
                  {it.emoji ? <span style={{ fontSize: 20 }}>{it.emoji}</span> : <Icon name={it.icon || sec.icon || icon} size={20} />}
                </span>
                <span style={labelStyle}>{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
const tileStyle = (bg, line) => ({
  display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "12px 12px", minHeight: 62,
  borderRadius: 12, border: `1px solid ${line}`, background: bg, cursor: "pointer", fontFamily: "inherit",
});
const iconBox = (bg, fg) => ({
  width: 38, height: 38, borderRadius: 10, background: bg, color: fg, flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
});
const labelStyle = { fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.25, minWidth: 0 };
