// ---------------------------------------------------------------------------
// FIRST SCREENS, after the language: "I need something" or "I offer
// something"; and for those who offer, what they offer. Each choice is
// remembered, so these show once.
// ---------------------------------------------------------------------------
import React from "react";
import { T, Icon } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const shell = {
  position: "fixed", inset: 0, zIndex: 420, background: "#F7F9FA", overflowY: "auto",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
const wrap = { maxWidth: 460, margin: "0 auto", padding: "28px 18px 34px" };

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
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: "8px 0 20px", lineHeight: 1.25 }}>{t("start_title")}</h1>
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
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "4px 0 18px", lineHeight: 1.25 }}>{t("offer_title")}</h1>
        {types.map(([key, icon, bg, fg, title, sub]) => (
          <BigChoice key={key} icon={icon} bg={bg} fg={fg} title={title} sub={sub} onClick={() => onPick(key)} />
        ))}
      </div>
    </div>
  );
}
