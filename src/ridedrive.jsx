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
