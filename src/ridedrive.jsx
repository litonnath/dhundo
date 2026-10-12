// SMALL PARTS OF THE LIVE RIDE SCREENS (driver and passenger): the round call /
// message / details buttons, and the message sheet that opens from the message
// button, so the chat is not sitting open on the screen.
import React from "react";
import { T, Icon, CloseButton, useDismissable } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { RideChat } from "./ridechat.jsx";

const round = (bg, fg = "#fff") => ({
  width: 54, height: 54, borderRadius: "50%", border: "none", background: bg, color: fg, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", boxShadow: "0 3px 10px rgba(15,23,42,0.18)",
});

export function ActionIcons({ phone, onChat, onDetails, detailsOpen, extra = null }) {
  const { t } = useI18n();
  const cell = (node, label) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 64 }}>
      {node}
      <span style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>{label}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-start", gap: 6, margin: "10px 0" }}>
      {phone && cell(<a href={`tel:${phone}`} aria-label={t("rdv_call")} style={round("#15803D")}><Icon name="phone" size={24} /></a>, t("rdv_call"))}
      {onChat && cell(<button onClick={onChat} aria-label={t("rdv_chat")} style={round("#0A5BB8")}><Icon name="chat" size={24} /></button>, t("rdv_chat"))}
      {extra}
      {onDetails && cell(<button onClick={onDetails} aria-expanded={!!detailsOpen} aria-label={t("rdv_details")} style={round(detailsOpen ? "#111827" : "#E5E7EB", detailsOpen ? "#fff" : "#111827")}><span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{detailsOpen ? "✕" : "⋯"}</span></button>, t("rdv_details"))}
    </div>
  );
}

export function ChatSheet({ api, rideId, role, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, padding: "12px 14px calc(16px + env(safe-area-inset-bottom))", maxHeight: "86vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: T.ink }}>{t("rdv_chat")}</div>
          <CloseButton onClick={onClose} />
        </div>
        <RideChat api={api} rideId={rideId} role={role} startOpen />
      </div>
    </div>
  );
}

// The live ride fills the whole screen like a taxi app: the map behind, a sheet at
// the bottom with the details and buttons. "Home" folds it into a small bar (the
// ride and the driver's position sharing keep running behind it).
export function RideShell({ hidden, onMin, map, children }) {
  const { t } = useI18n();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 560, background: "#E8EEF4", display: hidden ? "none" : "block" }}>
      {map}
      <button onClick={onMin} style={{ position: "absolute", left: 12, top: "calc(12px + env(safe-area-inset-top))", zIndex: 6, minHeight: 44, padding: "0 16px 0 12px", borderRadius: 22, border: "none", background: "#fff", color: T.ink, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 10px rgba(0,0,0,.25)", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span aria-hidden="true">{"\u2039"}</span>{t("rdv_home")}
      </button>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 6, background: "#fff", borderRadius: "22px 22px 0 0", boxShadow: "0 -6px 24px rgba(15,23,42,.22)", padding: "12px 14px calc(14px + env(safe-area-inset-bottom))", maxHeight: "62dvh", overflowY: "auto", boxSizing: "border-box", maxWidth: 640, margin: "0 auto" }}>
        <div aria-hidden="true" style={{ width: 44, height: 5, borderRadius: 3, background: "#D1D5DB", margin: "0 auto 8px" }} />
        {children}
      </div>
    </div>
  );
}

export function RideBar({ title, sub, onOpen }) {
  const { t } = useI18n();
  return (
    <button onClick={onOpen} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", minHeight: 62, padding: "10px 14px", margin: "6px 0 12px", borderRadius: 14, border: "2px solid #16A34A", background: "#F0FAF4", cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: T.ink }}>{title}</span>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#157A43" }}>{sub}</span>
      </span>
      <span style={{ fontWeight: 800, color: "#157A43" }}>{t("rdv_open")}</span>
    </button>
  );
}
