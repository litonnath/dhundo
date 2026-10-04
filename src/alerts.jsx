// "Get alerts when the app is closed": one card, used wherever somebody is
// waiting for something (orders, rides, delivery jobs).
import React, { useState, useEffect } from "react";
import { T, Icon, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { pushState, enablePush, disablePush, pushSupported } from "./push.js";

export function AlertsCard({ api, compact = false }) {
  const { t, lang } = useI18n();
  const [st, setSt] = useState("unsupported");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let a = true; pushState().then((s) => { if (a) setSt(s); }); return () => { a = false; }; }, []);
  if (!pushSupported() || st === "unsupported" || !api) return null;
  const on = async () => { setBusy(true); setSt(await enablePush(api, lang)); setBusy(false); };
  const off = async () => { setBusy(true); await disablePush(api); setSt("off"); setBusy(false); };
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start", padding: compact ? "10px 12px" : "13px 14px",
      background: st === "on" ? "#EAF8EF" : T.brandSoft, border: `1px solid ${T.line}`, borderRadius: 14, margin: "10px 0",
    }}>
      <span style={{ color: T.brandDark, flexShrink: 0, marginTop: 2 }}><Icon name="alert" size={22} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: T.ink }}>{t("pn_title")}</span>
        {st !== "on" && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5, margin: "3px 0 8px" }}>{t("pn_sub")}</span>}
        {st === "on" && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, margin: "3px 0 6px" }}>{t("pn_enabled")}</span>}
        {st === "denied" && <span style={{ display: "block", fontSize: 12.5, color: "#B45309" }}>{t("pn_denied")}</span>}
        {(st === "off" || st === "error") && <Btn disabled={busy} onClick={on}>{busy ? "…" : t("pn_on")}</Btn>}
        {st === "on" && (
          <button onClick={off} disabled={busy} style={{ background: "none", border: "none", color: T.brandDark, fontWeight: 700, cursor: "pointer", padding: 0, minHeight: 36, fontFamily: "inherit" }}>{t("pn_off")}</button>
        )}
      </span>
    </div>
  );
}
