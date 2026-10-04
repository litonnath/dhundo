// ---------------------------------------------------------------------------
// FIRST SCREENS, after the language: "I need something" or "I offer
// something"; and for those who offer, what they offer. Each choice is
// remembered, so these show once.
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from "react";
import { T, Icon } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

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
export function OfferTypeGate({ onPick, onBack }) {
  const { t } = useI18n();
  const types = [
    ["worker", "construction", "#FFF1E6", "#B45309", t("home_worker"), t("offer_sub_worker")],
    ["ride", "drivers", "#E8F1FF", "#1D4ED8", t("home_ride"), t("offer_sub_ride")],
    ["shop", "suppliers", "#EAF7EE", "#15803D", t("home_shop"), t("offer_sub_shop")],
    ["eat", "food", "#FFF4D6", "#A16207", t("home_eat"), t("offer_sub_eat")],
    ["sell", "tag", "#F3E8FF", "#7E22CE", t("mk_my_ads"), t("offer_sub_sell")],
  ];
  return (
    <div style={shell} role="dialog" aria-modal="true">
      <div style={wrap}>
        <button onClick={onBack} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
          color: T.brandDark, fontSize: 15, fontWeight: 700, cursor: "pointer", padding: "6px 0",
          fontFamily: "inherit", minHeight: 44,
        }}><Icon name="back" size={18} /> {t("w_back")}</button>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: "4px 0 20px", lineHeight: 1.25, textAlign: "center" }}>{t("offer_title")}</h1>
        {types.map(([key, icon, bg, fg, title, sub]) => (
          <BigChoice key={key} icon={icon} bg={bg} fg={fg} title={title} sub={sub} onClick={() => onPick(key)} />
        ))}
      </div>
    </div>
  );
}


// THE FRONT OF THE APP for somebody who needs something: only these tiles,
// big and centred. Each one opens its own screen.
const TILES = [
  ["worker", "construction", "#F97316", "#FB923C", "home_worker", "offer_sub_worker"],
  ["ride", "drivers", "#2563EB", "#3B82F6", "home_ride", "offer_sub_ride"],
  ["shop", "suppliers", "#16A34A", "#22C55E", "home_shop", "offer_sub_shop"],
  ["eat", "food", "#D97706", "#F59E0B", "home_eat", "offer_sub_eat"],
  ["market", "tag", "#9333EA", "#A855F7", "mk_tab", "mk_tab_sub"],
  ["partner", "user", "#0D9488", "#14B8A6", "home_partner", "home_partner_sub"],
];

export function CustomerLauncher({ onPick }) {
  const { t } = useI18n();
  // Three across on a wide screen, two on a phone: always even rows.
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 600);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 600);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return (
    <div style={{
      minHeight: "calc(100vh - 190px)", display: "flex", flexDirection: "column",
      justifyContent: "center", padding: "26px 16px 30px", boxSizing: "border-box",
    }}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: "0 0 20px", textAlign: "center", lineHeight: 1.25 }}>
          {t("launch_title")}
        </h1>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? 3 : 2}, 1fr)`, gap: 14 }}>
          {TILES.map(([key, icon, c1, c2, label, sub]) => (
            <button key={key} onClick={() => onPick(key)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10,
              padding: "22px 12px 18px", borderRadius: 22, border: `1px solid ${T.line}`, background: T.white,
              cursor: "pointer", fontFamily: "inherit", minHeight: 168,
              boxShadow: "0 6px 18px rgba(15,20,25,0.07)",
            }}>
              <span style={{
                width: 76, height: 76, borderRadius: 24, color: "#fff", flexShrink: 0,
                background: `linear-gradient(145deg, ${c1}, ${c2})`,
                boxShadow: `0 8px 18px ${c1}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Icon name={icon} size={38} /></span>
              <span style={{ fontSize: 17, fontWeight: 800, color: T.ink, lineHeight: 1.25 }}>{t(label)}</span>
              <span style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4 }}>{t(sub)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
