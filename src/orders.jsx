// ---------------------------------------------------------------------------
// ACTIVITY: one list, like Swiggy or Uber. Two choices only: Active (what is
// happening now) and Past. Everything you ordered, bought or sold, and, if you
// run a business or drive, the work waiting for you, is on this one screen.
// ---------------------------------------------------------------------------
import React, { useState } from "react";
import { T, Icon, BLUE_WASH, PageHero, blueCard, blueTile } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { OwnerOrders, OwnerHistory, MyOrdersList } from "./food.jsx";
import { ItemOrdersList } from "./itemorders.jsx";
import { RiderJobs, RiderHistory } from "./hub.jsx";
import { RideRequests, RideHistory } from "./ride.jsx";
import { MyBookings } from "./mybookings.jsx";


export function OrdersPage({ api, role, online, where, trades, onHire, badge = 0, bizMode = false, bookings = [], onChat = null, onBookingsChanged = null }) {
  const { t } = useI18n();
  const [view, setView] = useState("active");
  const showWork = !!role && bizMode;
  const [part, setPart] = useState(() => {
    let want = null;
    try { want = window.localStorage.getItem("dhundo_orders_tab"); if (want) window.localStorage.removeItem("dhundo_orders_tab"); } catch (_) {}
    return want === "work" && role ? "work" : want === "mine" ? "mine" : want === "items" ? "items" : want === "rides" ? "rides" : want === "bookings" ? "bookings" : showWork ? "work" : null;
  });
  const workKey = role === "owner" ? "or_received" : role === "delivery" ? "or_jobs" : "or_rides";
  const tiles = (showWork ? [["work", "bag", t(workKey), badge]] : [
    ["mine", "bag", t("or_mine"), 0],
    ["bookings", "user", t("mbk_title"), 0],
    ["items", "tag", t("mb_mine"), 0],
    ["rides", "drivers", t("rh_title"), 0],
  ]);
  const title = part === "work" ? t(workKey) : part === "mine" ? t("or_mine") : part === "items" ? t("mb_mine") : part === "bookings" ? t("mbk_title") : part === "rides" ? t("rh_title") : t("nav_activity");
  return (
    <div style={{ background: BLUE_WASH, minHeight: "70vh" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 16px 120px" }}>
      {part && (
        <button onClick={() => setPart(null)} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: T.white, border: `1px solid ${T.line}`, borderRadius: 20,
          padding: "7px 14px", minHeight: 40, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: T.brandDark, marginBottom: 10,
        }}><Icon name="back" size={16} /> {t("w_back")}</button>
      )}
      {part ? <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px", color: "#0B3A78" }}>{title}</h1> : <PageHero title={title} sub={t("or_hero_sub")} />}

      {!part ? (
        <div style={{ display: "grid", gap: 10 }}>
          {tiles.map(([k, icon, label, n]) => (
            <button key={k} onClick={() => { setPart(k); setView("active"); }} style={{
              position: "relative", display: "flex", alignItems: "center", gap: 14, minHeight: 76, padding: "12px 14px", borderRadius: 16, textAlign: "left",
              ...blueCard, cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, ...blueTile, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={23} /></span>
              <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: "#0B3A78" }}>{label}</span>
              {n > 0 && <span style={{ minWidth: 24, height: 24, borderRadius: 12, background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{n}</span>}
              <Icon name="chev" size={18} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
            </button>
          ))}
        </div>
      ) : (
        part === "rides" ? <RideHistory api={api} /> : <>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            {[["active", "ac_active"], ["past", "ac_past"]].map(([k, key]) => (
              <button key={k} onClick={() => setView(k)} aria-pressed={view === k} style={{
                flex: 1, minHeight: 44, borderRadius: 22, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15,
                border: `1.5px solid ${view === k ? T.brandDark : T.line}`, background: view === k ? T.brandDark : T.white, color: view === k ? "#fff" : T.ink,
              }}>{t(key)}</button>
            ))}
          </div>
          {part === "work" && view === "active" && (
            <>
              {role === "owner" && <OwnerOrders api={api} onHire={onHire} />}
              {role === "delivery" && <RiderJobs api={api} online={online} where={where} />}
              {role === "ride" && <RideRequests api={api} online={online} trades={trades} where={where} />}
            </>
          )}
          {part === "work" && view === "past" && (role === "ride" ? <RideHistory api={api} /> : role === "owner" ? <OwnerHistory api={api} /> : role === "delivery" ? <RiderHistory api={api} /> : <div style={{ margin: "14px 0", color: T.inkSoft, fontSize: 14 }}>{t("st_noorders")}</div>)}
          {part === "mine" && <MyOrdersList api={api} view={view} showEmpty />}
          {part === "bookings" && <MyBookings api={api} items={bookings} view={view} onChat={onChat} onChanged={onBookingsChanged} />}
          {part === "items" && <ItemOrdersList api={api} onHire={onHire} view={view} />}
        </>
      )}
    </div>
    </div>
  );
}
