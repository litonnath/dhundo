// ---------------------------------------------------------------------------
// THE MENU: what used to be banners on the home screen. Switching between
// "I need" and "I offer", installing the app, getting help to sign up,
// privacy and contact -- one tap from the bottom bar, out of the way of
// the screens people actually use.
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from "react";
import { T, Icon, CloseButton, useDismissable } from "./ui.jsx";
import { CONTACT } from "./brand.jsx";
import { useI18n } from "./i18n.jsx";
import { useInstallPrompt, isInstalledApp } from "./device.jsx";
import { AlertsCard } from "./alerts.jsx";

export function MenuSheet({ api, mode, onMode, onInstall, onAccount, signedIn, onClose, sections = [] }) {
  const { t } = useI18n();
  const { isIos, installed } = useInstallPrompt();
  useDismissable(true, onClose);
  // Centred on a wide screen, a bottom sheet on a phone.
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 700);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 700);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const canInstall = !(installed || isIos || isInstalledApp());
  const num = String(CONTACT.whatsapp || "").replace(/\D/g, "");
  const help = num ? `https://wa.me/${num}?text=${encodeURIComponent(t("sh_msg"))}` : null;

  const row = (icon, title, sub, go, href, badge = 0) => {
    const inner = (
      <>
        <span style={{ width: 40, height: 40, borderRadius: 10, background: T.brandSoft, color: T.brandDark,
                       display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={icon} size={20} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: T.ink }}>{title}</span>
          {sub && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4, marginTop: 1 }}>{sub}</span>}
        </span>
        {badge > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{badge > 99 ? "99+" : badge}</span>}
        <Icon name="chev" size={18} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
      </>
    );
    const st = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 2px", border: "none",
                 borderBottom: `1px solid ${T.line}`, background: "none", cursor: "pointer", textAlign: "left",
                 fontFamily: "inherit", textDecoration: "none", boxSizing: "border-box" };
    return href
      ? <a key={title} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" style={st}>{inner}</a>
      : <button key={title} onClick={go} style={st}>{inner}</button>;
  };

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,20,25,0.55)",
                  display: "flex", alignItems: wide ? "center" : "flex-end", justifyContent: "center", padding: wide ? 16 : 0 }}>
      <div style={{ background: T.white, borderRadius: wide ? 18 : "18px 18px 0 0", width: "100%", maxWidth: 480,
                    padding: "14px 18px calc(22px + env(safe-area-inset-bottom))", maxHeight: "92vh",
                    overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0, color: T.ink }}>{t("menu_title")}</h1>
          <CloseButton onClick={onClose} />
        </div>

        {(() => {
          const m = mode === "offer" ? "need" : "offer";
          return (
            <button onClick={() => { onMode(m); onClose(); }} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50,
              borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 15.5, fontWeight: 800,
              border: `1.5px solid ${T.brandDark}`, background: T.brandDark, color: "#fff",
            }}><Icon name={m === "need" ? "search" : "edit"} size={18} /> {m === "need" ? t("hm_findorder") : t("hm_earn")}</button>
          );
        })()}

        {signedIn && sections.map((sec) => (
          <div key={sec.title} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{sec.title}</div>
            {sec.rows.map((r) => row(r.icon, r.title, r.sub, () => { r.go(); onClose(); }, null, r.badge || 0))}
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{t("ms_more")}</div>
        </div>
        {signedIn && <AlertsCard api={api} compact />}
        {row("user", signedIn ? t("nav_account") : t("nav_signin"), null, () => { onAccount(); onClose(); })}
        {canInstall && row("download", t("install_app"), t("install_sub"), () => { onClose(); onInstall(); })}
        {help && row("help", t("sh_title"), t("sh_menu_sub"), null, help)}
        {row("shield", t("pn_link"), null, null, "/privacy")}
        {CONTACT.phone && row("phone", `${t("ft_call")}: ${CONTACT.phone}`, null, null, `tel:${CONTACT.phone.replace(/[^+\d]/g, "")}`)}
      </div>
    </div>
  );
}
