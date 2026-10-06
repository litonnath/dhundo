// ---------------------------------------------------------------------------
// ACTIVITY: one list, like Swiggy or Uber. Two choices only: Active (what is
// happening now) and Past. Everything you ordered, bought or sold, and, if you
// run a business or drive, the work waiting for you, is on this one screen.
// ---------------------------------------------------------------------------
import React, { useState } from "react";
import { T } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { OwnerOrders, MyOrdersList } from "./food.jsx";
import { ItemOrdersList } from "./itemorders.jsx";
import { RiderJobs } from "./hub.jsx";
import { RideRequests, RideHistory } from "./ride.jsx";

const head = { fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 8px" };

export function OrdersPage({ api, role, online, where, trades, onHire }) {
  const { t } = useI18n();
  const [view, setView] = useState("active");
  try { window.localStorage.removeItem("dhundo_orders_tab"); } catch (_) {}
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 16px 120px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px", color: T.ink }}>{t("nav_activity")}</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {[["active", "ac_active"], ["past", "ac_past"]].map(([k, key]) => (
          <button key={k} onClick={() => setView(k)} aria-pressed={view === k} style={{
            flex: 1, minHeight: 44, borderRadius: 22, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15,
            border: `1.5px solid ${view === k ? T.brandDark : T.line}`, background: view === k ? T.brandDark : T.white, color: view === k ? "#fff" : T.ink,
          }}>{t(key)}</button>
        ))}
      </div>

      {view === "active" && role && (
        <>
          <div style={head}>{t(role === "owner" ? "or_received" : role === "delivery" ? "or_jobs" : "or_rides")}</div>
          {role === "owner" && <OwnerOrders api={api} onHire={onHire} />}
          {role === "delivery" && <RiderJobs api={api} online={online} where={where} />}
          {role === "ride" && <RideRequests api={api} online={online} trades={trades} where={where} />}
        </>
      )}
      {view === "past" && role === "ride" && (<><div style={head}>{t("or_rides")}</div><RideHistory api={api} /></>)}

      <MyOrdersList api={api} view={view} showEmpty title={<div style={head}>{t("or_mine")}</div>} />
      <ItemOrdersList api={api} onHire={onHire} view={view} title={<div style={head}>{t("mb_mine")}</div>} />
    </div>
  );
}

