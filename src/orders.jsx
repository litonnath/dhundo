// ---------------------------------------------------------------------------
// ORDERS: one place, on the bottom bar for everyone, for everything that is in
// progress. What you ordered, what you are buying or selling second hand, and,
// depending on what you do on Dhundo: the orders your restaurant or shop has
// received, the delivery jobs for a rider, the ride requests for a driver.
// Messages, codes and history sit inside each order, so nothing hides under the
// account or dashboard.
// ---------------------------------------------------------------------------
import React, { useState } from "react";
import { T } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { OwnerOrders, MyOrdersList } from "./food.jsx";
import { ItemOrdersList } from "./itemorders.jsx";
import { RiderJobs } from "./hub.jsx";
import { RideRequests, RideHistory } from "./ride.jsx";

export function OrdersPage({ api, role, online, where, trades, onHire }) {
  const { t } = useI18n();
  const [tab, setTab] = useState(() => {
    let want = null;
    try { want = window.localStorage.getItem("dhundo_orders_tab"); if (want) window.localStorage.removeItem("dhundo_orders_tab"); } catch (_) {}
    return want === "items" ? "items" : want === "mine" ? "mine" : role ? "work" : "mine";
  });
  const pills = [role ? ["work", role === "owner" ? "or_received" : role === "delivery" ? "or_jobs" : "or_rides"] : null, ["mine", "or_mine"], ["items", "mb_mine"]].filter(Boolean);
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 16px 120px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px", color: T.ink }}>{t("nav_activity")}</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {pills.map(([k, key]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} style={{
            minHeight: 42, padding: "0 16px", borderRadius: 21, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
            border: `1.5px solid ${tab === k ? T.brandDark : T.line}`, background: tab === k ? T.brandDark : T.white, color: tab === k ? "#fff" : T.ink,
          }}>{t(key)}</button>
        ))}
      </div>
      {tab === "work" && role === "owner" && <OwnerOrders api={api} onHire={onHire} />}
      {tab === "work" && role === "delivery" && <RiderJobs api={api} online={online} where={where} />}
      {tab === "work" && role === "ride" && (
        <>
          <RideRequests api={api} online={online} trades={trades} where={where} />
          <RideHistory api={api} />
        </>
      )}
      {tab === "mine" && <MyOrdersList api={api} />}
      {tab === "items" && <ItemOrdersList api={api} onHire={onHire} />}
    </div>
  );
}
