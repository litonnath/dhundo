// ---------------------------------------------------------------------------
// ORDER FOOD AND SHOP: the customer side opens like a food app (restaurants
// and shops near you, tap one to see its menu, add items, send an order),
// and the owner side manages the menu and the orders. Nobody pays in the app:
// they settle it between themselves.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { T, Btn, Icon, Notice, input, CloseButton, useDismissable, Chip, groupStyle, Hero } from "./ui.jsx";
import { PlaceField } from "./locpicker.jsx";
import { TileArt } from "./scenes.jsx";
import { shrink, ScrollRow } from "./market.jsx";
import { AlertsCard } from "./alerts.jsx";
import { SubCategories, tradeIcon } from "./start.jsx";
import { useI18n } from "./i18n.jsx";

const one = (r) => (Array.isArray(r) ? r[0] : r);
const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const rupees = (p) => `₹${Math.round(p / 100)}`;
const card = { background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "13px 14px", marginBottom: 10 };
const GREEN = "#0F8A3C", RED = "#B91C1C";

function VegMark({ veg }) {
  const c = veg ? GREEN : RED;
  return (
    <span aria-label={veg ? "veg" : "non-veg"} style={{
      width: 16, height: 16, border: `1.5px solid ${c}`, borderRadius: 3, display: "inline-flex",
      alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box",
    }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} /></span>
  );
}

const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
// "Open · 30 min", "Closed · opens 9:00 AM" under a name.
function OpenLine({ info, t }) {
  if (!info) return null;
  const parts = [];
  parts.push(info.open_now
    ? <span key="o" style={{ color: GREEN, fontWeight: 800 }}>{t("st_open")}</span>
    : <span key="o" style={{ color: RED, fontWeight: 800 }}>{t("st_closed")}</span>);
  if (!info.open_now && info.open_time) parts.push(<span key="h">{String(t("st_opens")).replace("{t}", fmtTime(info.open_time))}</span>);
  if (info.open_now && info.close_time) parts.push(<span key="c">{String(t("st_until")).replace("{t}", fmtTime(info.close_time))}</span>);
  if (info.delivery_mins) parts.push(<span key="d">{String(t("st_mins")).replace("{n}", info.delivery_mins)}</span>);
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", fontSize: 13, color: T.inkSoft, marginTop: 3 }}>
      {parts.map((x, i) => <React.Fragment key={i}>{i > 0 && <span>·</span>}{x}</React.Fragment>)}
    </span>
  );
}

const statusColor = { placed: "#B45309", accepted: "#1D4ED8", ready: GREEN, delivered: GREEN, rejected: RED, cancelled: T.inkFaint };

// ============================================================ CUSTOMER HOME
export function StoreHome({ kind, api, trades, place, user, onSignIn, renderEmpty }) {
  const { t, lang } = useI18n();
  const eat = kind === "eat";
  const [chip, setChip] = useState(null);
  // false = the sub-category tiles, like the Worker screen; true = the places.
  const [picked, setPicked] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [infos, setInfos] = useState({});

  const kinds = useMemo(() => trades.filter((x) =>
    eat ? x.group_name === "Eat & Stay" : (x.kind === "supplier" || x.group_name === "Suppliers") && x.group_name !== "Eat & Stay"), [trades, eat]);
  const slugs = useMemo(() => new Set(kinds.map((x) => x.slug)), [kinds]);
  const nameOf = (x) => (lang === "bn" && x.name_bn) || (lang === "hi" && x.name_hi) || x.name_en;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.browse({
      trade: chip, group: eat && !chip ? "Eat & Stay" : null, kind: eat ? null : "supplier",
      state: place && place.state, lat: place && place.lat, lng: place && place.lng, limit: 40,
    }).then((r) => {
      if (!alive) return;
      const list = many(r).filter((x) => slugs.has(x.trade_slug));
      setRows(list); setLoading(false);
      if (list.length) {
        api.storeInfos(list.map((x) => x.id)).then((inf) => {
          if (!alive) return;
          const o = {}; many(inf).forEach((i) => { o[i.id] = i; }); setInfos(o);
        }).catch(() => {});
      }
    })
      .catch(() => { if (alive) { setRows([]); setLoading(false); } });
    return () => { alive = false; };
  }, [api, chip, eat, slugs, place && place.state, place && place.lat, place && place.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = rows
    .filter((r) => !q.trim() || `${r.display_name || ""} ${r.trade_name || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (infos[b.id] && infos[b.id].open_now ? 1 : 0) - (infos[a.id] && infos[a.id].open_now ? 1 : 0));
  const stage1 = !picked && !q.trim();
  const gs = groupStyle(eat ? "Eat & Stay" : "Suppliers");
  return (
    <>
    <Hero search={q} setSearch={setQ} onVoice={setQ} compact={!stage1} tone={eat ? "eat" : "shop"}
          title={t(eat ? "st_eat_title" : "st_shop_title")} sub={t(eat ? "st_eat_sub" : "st_shop_sub")} placeholder={t("st_search")} />
    <div style={{ maxWidth: stage1 ? 1000 : 760, margin: "0 auto", padding: "62px 16px 130px" }}>
      {stage1 ? (
        <TileArt k={eat ? "need-eat" : "shop"} pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 280, marginBottom: 16 }} />
      ) : (
        <button onClick={() => { setQ(""); setPicked(false); }} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
          color: T.brandDark, fontWeight: 700, fontSize: 14.5, padding: "0 0 8px", minHeight: 40, fontFamily: "inherit",
        }}><Icon name="back" size={17} /> {t(eat ? "st_eat_title" : "st_shop_title")}</button>
      )}
      {stage1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 4px" }}>
          <h2 style={{ flex: 1, fontSize: 20, fontWeight: 800, color: T.ink, margin: 0 }}>{t(eat ? "home_eat" : "home_shop")}</h2>
          {user && user.id && (
            <button onClick={() => setOrdersOpen(true)} style={{
              border: `1px solid ${T.line}`, background: T.white, borderRadius: 20, padding: "8px 14px", minHeight: 40,
              fontWeight: 700, fontSize: 14, color: T.brandDark, cursor: "pointer", fontFamily: "inherit",
            }}>{t("st_orders")}</button>
          )}
        </div>
      )}
      {stage1 && <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 14px" }}>{t("what_need")}</p>}
      {stage1 ? (
        <SubCategories
          icon={gs.icon} fg={gs.fg} bg={gs.bg}
          items={kinds.map((x) => ({ key: x.slug, label: nameOf(x), icon: tradeIcon(x, gs.icon) }))}
          onPick={(slug) => { setChip(slug); setPicked(true); }}
          onAll={() => { setChip(null); setPicked(true); }} allLabel={t("st_all")} />
      ) : (<>
      <div style={{ marginBottom: 6 }}>
        <ScrollRow>
          <span style={{ flexShrink: 0 }}><Chip active={!chip} onClick={() => setChip(null)}>{t("st_all")}</Chip></span>
          {kinds.map((x) => <span key={x.slug} style={{ flexShrink: 0, whiteSpace: "nowrap" }}><Chip active={chip === x.slug} onClick={() => setChip(x.slug)}>{nameOf(x)}</Chip></span>)}
        </ScrollRow>
      </div>
      {loading ? <div style={{ color: T.inkFaint, padding: 16 }}>…</div> : shown.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: T.inkSoft, padding: 28 }}>{t("st_none")}</div>
      ) : shown.map((r) => (
        <button key={r.id} onClick={() => setOpen(r)} style={{
          display: "block", width: "100%", textAlign: "left", padding: 0, marginBottom: 14, overflow: "hidden",
          borderRadius: 16, border: `1px solid ${T.line}`, background: T.white, cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 3px 12px rgba(15,20,25,0.07)",
        }}>
          <Cover row={r} eat={eat} height={150} />
          <span style={{ display: "block", padding: "11px 14px 13px" }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ flex: 1, fontSize: 17, fontWeight: 800, color: T.ink }}>{r.display_name}</span>
              {r.distance_km != null && <span style={{ fontSize: 13, fontWeight: 700, color: T.brandDark }}>{String(t("st_away")).replace("{n}", r.distance_km)}</span>}
            </span>
            <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft, marginTop: 2 }}>
              {[r.trade_name, r.locality || r.area || r.city].filter(Boolean).join(" · ")}
            </span>
            <OpenLine info={infos[r.id]} t={t} />
          </span>
        </button>
      ))}
      </>)}
      {open && <StorePage api={api} row={open} eat={eat} info={infos[open.id]} place={place} user={user} onSignIn={onSignIn}
                          renderEmpty={renderEmpty} onClose={() => setOpen(null)} onOrdered={() => setOrdersOpen(true)} />}
      {ordersOpen && <MyOrdersSheet api={api} onClose={() => setOrdersOpen(false)} />}
    </div>
    </>
  );
}

function Cover({ row, eat, height }) {
  const src = (row.photos && row.photos[0]) || row.avatar_url;
  return src ? (
    <span style={{ display: "block", height, background: `center/cover url(${src}) ${T.line}` }} />
  ) : (
    <TileArt k={eat ? "eat" : "shop"} style={{ aspectRatio: "auto", height }} />
  );
}

// ====================================================== STORE PAGE (menu)
function StorePage({ api, row, eat, info, place, user, onSignIn, renderEmpty, onClose, onOrdered }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [menu, setMenu] = useState(null);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.menuGet(row.id).then((r) => { if (alive) setMenu(many(r)); }).catch(() => { if (alive) setMenu([]); });
    return () => { alive = false; };
  }, [api, row.id]);

  const accepting = (!menu || menu.length === 0 || menu[0].accepting !== false) && !(info && info.open_now === false);
  const byCat = useMemo(() => {
    const o = {};
    (menu || []).forEach((m) => { (o[m.category] = o[m.category] || []).push(m); });
    return o;
  }, [menu]);
  const lines = (menu || []).filter((m) => cart[m.id] > 0);
  const count = lines.reduce((n, m) => n + cart[m.id], 0);
  const total = lines.reduce((n, m) => n + cart[m.id] * m.price_paise, 0);
  const setQty = (id, d) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(20, (c[id] || 0) + d)) }));

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 500, background: "#F7F8FA", overflowY: "auto" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 120 }}>
        <div style={{ position: "relative" }}>
          <Cover row={row} eat={eat} height={190} />
          <button onClick={onClose} aria-label="Back" style={{
            position: "absolute", top: 12, left: 12, width: 42, height: 42, borderRadius: "50%", border: "none",
            background: "rgba(255,255,255,0.95)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}><Icon name="back" size={20} /></button>
        </div>
        <div style={{ padding: "14px 16px 4px", background: T.white, borderBottom: `1px solid ${T.line}` }}>
          <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, color: T.ink }}>{row.display_name}</h1>
          <div style={{ fontSize: 14, color: T.inkSoft, margin: "3px 0 12px" }}>
            {[row.trade_name, row.locality || row.area || row.city].filter(Boolean).join(" · ")}
            {row.distance_km != null ? ` · ${String(t("st_away")).replace("{n}", row.distance_km)}` : ""}
          </div>
          {info && <div style={{ margin: "-8px 0 12px" }}><OpenLine info={info} t={t} /></div>}
          {!accepting && <div style={{ marginBottom: 12 }}><Notice tone="bad">{t("st_closed_err")}</Notice></div>}
        </div>

        <div style={{ padding: "14px 16px" }}>
          {menu === null ? <div style={{ color: T.inkFaint }}>…</div> : menu.length === 0 ? (
            <>
              <Notice tone="info">{t("st_nomenu")}</Notice>
              <div style={{ marginTop: 12 }}>{renderEmpty ? renderEmpty(row) : null}</div>
            </>
          ) : Object.keys(byCat).map((cat) => (
            <div key={cat} style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 8px", color: T.ink }}>{cat}</h2>
              {byCat[cat].map((m) => (
                <div key={m.id} style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {eat && <VegMark veg={m.veg} />}
                      <span style={{ fontSize: 15.5, fontWeight: 700, color: T.ink }}>{m.name}</span>
                    </span>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: T.ink, marginTop: 3 }}>{rupees(m.price_paise)}</span>
                    {m.about && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{m.about}</span>}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {m.photo_url && <span style={{ width: 92, height: 92, borderRadius: 12, background: `center/cover url(${m.photo_url}) ${T.line}` }} />}
                    <Stepper qty={cart[m.id] || 0} disabled={!accepting} onAdd={() => setQty(m.id, 1)} onMinus={() => setQty(m.id, -1)} label={t("st_add")} />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {count > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 510, padding: "10px 16px calc(12px + env(safe-area-inset-bottom))", background: T.white, borderTop: `1px solid ${T.line}` }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <Btn full onClick={() => setCartOpen(true)}>
              {String(t("st_items_n")).replace("{n}", count)} · {rupees(total)} — {t("st_cart")}
            </Btn>
          </div>
        </div>
      )}
      {cartOpen && (
        <CartSheet api={api} row={row} eat={eat} info={info} lines={lines} cart={cart} setQty={setQty} total={total} place={place} user={user}
                   onSignIn={onSignIn} onClose={() => setCartOpen(false)}
                   onDone={() => { setCartOpen(false); setCart({}); onClose(); onOrdered && onOrdered(); }} />
      )}
    </div>
  );
}

function Stepper({ qty, onAdd, onMinus, disabled, label }) {
  if (qty === 0) {
    return (
      <button onClick={onAdd} disabled={disabled} style={{
        minWidth: 84, minHeight: 40, borderRadius: 10, border: `1.5px solid ${GREEN}`, background: T.white, color: GREEN,
        fontWeight: 800, fontSize: 14.5, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
      }}>{label}</button>
    );
  }
  const b = { width: 34, height: 40, border: "none", background: "none", color: "#fff", fontSize: 20, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: GREEN, borderRadius: 10, minWidth: 84, justifyContent: "space-between" }}>
      <button onClick={onMinus} style={b} aria-label="-">−</button>
      <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{qty}</span>
      <button onClick={onAdd} style={b} aria-label="+">+</button>
    </span>
  );
}

// ============================================================ CART / ORDER
function CartSheet({ api, row, eat, info, lines, cart, setQty, total, place, user, onSignIn, onClose, onDone }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [mode, setMode] = useState("delivery");
  const [addr, setAddr] = useState(() => (place && typeof place.lat === "number" ? place : null));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const signedIn = !!(user && user.id);
  const addrText = addr ? (addr.address || addr.area || "") : "";

  const send = async () => {
    if (!signedIn) { onSignIn && onSignIn(); return; }
    if (mode === "delivery" && addrText.trim().length < 3) { setMsg(t("st_need_addr")); return; }
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.orderPlace(row.id, lines.map((m) => ({ id: m.id, qty: cart[m.id] })), mode,
        mode === "delivery" ? addrText : null, addr && addr.lat, addr && addr.lng, note));
      if (r && r.ok) onDone();
      else setMsg(r && r.reason === "closed" ? t("st_closed_err") : r && r.reason === "sign_in_required" ? t("e_signin") : t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 530, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 560, padding: "14px 18px calc(20px + env(safe-area-inset-bottom))", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0 }}>{t("st_your_cart")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        {lines.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
            {eat && <VegMark veg={m.veg} />}
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{m.name}<span style={{ color: T.inkSoft }}> · {rupees(m.price_paise)}</span></span>
            <Stepper qty={cart[m.id]} onAdd={() => setQty(m.id, 1)} onMinus={() => { setQty(m.id, -1); if (cart[m.id] <= 1 && lines.length === 1) onClose(); }} label={t("st_add")} />
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, margin: "12px 0" }}>
          <span>{t("st_total")}</span><span>{rupees(total)}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["delivery", "st_delivery"], ["pickup", "st_pickup"]].map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} style={{
              flex: 1, minHeight: 44, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14.5,
              border: `1.5px solid ${mode === k ? T.brandDark : T.line}`, background: mode === k ? T.brandSoft : T.white, color: mode === k ? T.brandDark : T.ink,
            }}>{t(label)}</button>
          ))}
        </div>
        {mode === "delivery" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, marginBottom: 6 }}>{t("st_address")}</div>
            <PlaceField value={addr} onChange={setAddr} sheetPlace={addr || place} />
          </div>
        )}
        <input style={{ ...input, marginBottom: 8 }} value={note} maxLength={300} placeholder={t("st_note")} aria-label={t("st_note")}
               onChange={(e) => setNote(e.target.value)} />
        {mode === "delivery" && info && info.delivery_mins && (
          <p style={{ fontSize: 13.5, fontWeight: 700, color: T.brandDark, margin: "0 0 8px" }}>{String(t("st_mins")).replace("{n}", info.delivery_mins)}</p>
        )}
        <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>{t("st_pay_note")}</p>
        {msg && <div style={{ marginBottom: 10 }}><Notice tone="bad">{msg}</Notice></div>}
        <Btn full disabled={busy} onClick={send}>{busy ? "…" : signedIn ? `${t("st_place")} · ${rupees(total)}` : t("nav_signin")}</Btn>
      </div>
    </div>
  );
}

// ============================================================= MY ORDERS
export function MyOrdersSheet({ api, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [orders, setOrders] = useState(null);
  const load = useCallback(async () => {
    try { setOrders(many(await api.myOrders()).filter((o) => o.role === "customer")); } catch (_) { setOrders((o) => o || []); }
  }, [api]);
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, [load]);
  const cancel = async (o) => { try { await api.orderUpdate(o.id, "cancel"); } catch (_) {} load(); };
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 540, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#F7F8FA", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 560, padding: "14px 16px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0 }}>{t("st_orders")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        <AlertsCard api={api} compact />
        {orders === null ? "…" : orders.length === 0 ? <div style={{ color: T.inkSoft }}>{t("st_noorders")}</div> : orders.map((o) => (
          <div key={o.id} style={card}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{o.other_name}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: statusColor[o.status] }}>{t("st_status_" + o.status)}</span>
            </div>
            <Lines lines={o.lines} />
            <div style={{ fontSize: 14, fontWeight: 800, margin: "6px 0" }}>{t("st_total")}: {rupees(o.total_paise)} · {t(o.mode === "pickup" ? "st_pickup" : "st_delivery")}</div>
            {o.other_phone && <a href={`tel:${o.other_phone}`} style={{ color: T.brandDark, fontWeight: 700, fontSize: 14 }}>{o.other_phone}</a>}
            {o.delivery_mins && o.mode === "delivery" && ["placed", "accepted", "ready"].includes(o.status) && (
              <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>{String(t("st_mins")).replace("{n}", o.delivery_mins)}</div>
            )}
            {o.rider_name && (
              <div style={{ fontSize: 13.5, marginTop: 4 }}>{String(t("st_rider")).replace("{name}", o.rider_name)}{" "}
                {o.rider_phone && <a href={`tel:${o.rider_phone}`} style={{ color: T.brandDark, fontWeight: 700 }}>{o.rider_phone}</a>}</div>
            )}
            {o.status === "placed" && (
              <div><button onClick={() => cancel(o)} style={{ background: "none", border: "none", color: RED, fontWeight: 700, cursor: "pointer", minHeight: 40, padding: 0, fontFamily: "inherit" }}>{t("st_cancel")}</button></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Lines({ lines }) {
  return (
    <div style={{ fontSize: 13.5, color: T.inkSoft, margin: "4px 0", lineHeight: 1.5 }}>
      {many(lines).map((l, i) => <div key={i}>{l.qty} × {l.name}</div>)}
    </div>
  );
}

// ================================================================ OWNER
function StoreSettings({ api, shop }) {
  const { t } = useI18n();
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api.myStore().then((r) => {
      const x = one(r) || {};
      setF({ open: (x.open_time || "").slice(0, 5), close: (x.close_time || "").slice(0, 5),
             mins: x.delivery_mins ? String(x.delivery_mins) : "", autoRider: x.auto_rider !== false });
    }).catch(() => setF({ open: "", close: "", mins: "", autoRider: true }));
  }, [api]);
  if (!f) return null;
  const set = (k, v) => { setSaved(false); setF((x) => ({ ...x, [k]: v })); };
  const save = async () => {
    try { await api.setStore({ open: f.open || null, close: f.close || null, mins: f.mins ? Number(f.mins) : null, autoRider: f.autoRider }); setSaved(true); } catch (_) {}
  };
  const lab = { fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 4 };
  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{t("ow_hours")}</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <label style={{ flex: 1 }}><div style={lab}>{t("ow_open_at")}</div>
          <input type="time" style={input} value={f.open} onChange={(e) => set("open", e.target.value)} /></label>
        <label style={{ flex: 1 }}><div style={lab}>{t("ow_close_at")}</div>
          <input type="time" style={input} value={f.close} onChange={(e) => set("close", e.target.value)} /></label>
      </div>
      <label style={{ display: "block", marginBottom: 10 }}><div style={lab}>{t("ow_eta")}</div>
        <select style={input} value={f.mins} onChange={(e) => set("mins", e.target.value)}>
          <option value="">—</option>
          {[15, 30, 45, 60, 90, 120, 180, 240, 480].map((n) => <option key={n} value={n}>{n}</option>)}
        </select></label>
      {!shop && (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", minHeight: 44, marginBottom: 10 }}>
          <input type="checkbox" checked={f.autoRider} onChange={(e) => set("autoRider", e.target.checked)} style={{ marginTop: 4 }} />
          <span><span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{t("ow_rider")}</span>
            <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.45 }}>{t("ow_rider_sub")}</span></span>
        </label>
      )}
      <Btn kind="ghost" onClick={save}>{saved ? t("ow_store_saved") : t("ow_save")}</Btn>
    </div>
  );
}

export function OwnerFood({ api, shop }) {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, m] = await Promise.all([api.myOrders(), api.myMenu()]);
      setOrders(many(o).filter((x) => x.role === "owner"));
      setMenu(many(m));
    } catch (_) { /* the next tick tries again */ }
  }, [api]);
  useEffect(() => { load(); const id = setInterval(load, 12000); return () => clearInterval(id); }, [load]);

  const act = async (o, action) => { setBusy(o.id); try { await api.orderUpdate(o.id, action); } catch (_) {} setBusy(null); load(); };
  const accepting = menu.length === 0 || menu[0].accepting !== false;
  const toggle = async () => { try { await api.setAccepting(!accepting); } catch (_) {} load(); };
  const active = orders.filter((o) => ["placed", "accepted", "ready"].includes(o.status));

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t("ow_accepting")}</span>
        <button onClick={toggle} role="switch" aria-checked={accepting} style={{
          width: 52, height: 30, borderRadius: 15, border: "none", cursor: "pointer", position: "relative",
          background: accepting ? GREEN : "#C5CBD3",
        }}><span style={{ position: "absolute", top: 3, left: accepting ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "left .15s" }} /></button>
      </div>

      <StoreSettings api={api} shop={shop} />
      <AlertsCard api={api} />
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "14px 0 8px" }}>{t("ow_title_orders")}</h2>
      {active.length === 0 ? <div style={{ fontSize: 14, color: T.inkFaint }}>{t("ow_none")}</div> : active.map((o) => (
        <div key={o.id} style={{ ...card, border: `1.5px solid ${statusColor[o.status]}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{o.other_name}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: statusColor[o.status] }}>{t("st_status_" + o.status)}</span>
          </div>
          <Lines lines={o.lines} />
          <div style={{ fontSize: 14, fontWeight: 800, margin: "4px 0" }}>{rupees(o.total_paise)} · {t(o.mode === "pickup" ? "st_pickup" : "st_delivery")}</div>
          {o.address_text && <div style={{ fontSize: 13.5, color: T.ink }}>{o.address_text}</div>}
          {o.note && <div style={{ fontSize: 13, color: T.inkSoft, fontStyle: "italic" }}>{o.note}</div>}
          {o.other_phone && <a href={`tel:${o.other_phone}`} style={{ display: "inline-block", margin: "6px 0", color: T.brandDark, fontWeight: 700 }}>{o.other_phone}</a>}
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {o.status === "placed" && <>
              <Btn disabled={busy === o.id} onClick={() => act(o, "accept")}>{t("ow_accept")}</Btn>
              <Btn kind="ghost" disabled={busy === o.id} onClick={() => act(o, "reject")}>{t("ow_reject")}</Btn>
            </>}
            {o.status === "accepted" && <Btn disabled={busy === o.id} onClick={() => act(o, "ready")}>{t("ow_ready")}</Btn>}
            {["accepted", "ready"].includes(o.status) && <Btn kind="ghost" disabled={busy === o.id} onClick={() => act(o, "delivered")}>{t("ow_delivered")}</Btn>}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", margin: "18px 0 8px" }}>
        <h2 style={{ flex: 1, fontSize: 17, fontWeight: 800, margin: 0 }}>{t(shop ? "ow_prod" : "ow_menu")}</h2>
        <Btn kind="ghost" onClick={() => setEditing({})}>{t("ow_add")}</Btn>
      </div>
      {menu.map((m) => (
        <div key={m.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10, opacity: m.available ? 1 : 0.55 }}>
          {m.photo_url && <span style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: `center/cover url(${m.photo_url}) ${T.line}` }} />}
          {!shop && <VegMark veg={m.veg} />}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{m.name}</span>
            <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft }}>{m.category} · {rupees(m.price_paise)}</span>
          </span>
          <button onClick={() => setEditing(m)} style={{ background: "none", border: "none", color: T.brandDark, fontWeight: 700, cursor: "pointer", minHeight: 40, fontFamily: "inherit" }}>{t("ow_edit")}</button>
        </div>
      ))}
      {editing && <ItemForm api={api} item={editing} shop={shop} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ItemForm({ api, item, shop, onClose, onSaved }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [f, setF] = useState({
    name: item.name || "", price: item.price_paise ? String(Math.round(item.price_paise / 100)) : "",
    category: item.category || "", about: item.about || "", veg: item.veg !== false, available: item.available !== false,
    photo: item.photo_url || "",
  });
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    setUpBusy(true); setMsg(null);
    try { set("photo", await api.uploadPublic("services-photos", await shrink(file))); }
    catch (_) { setMsg(t("mk_e_upload")); }
    setUpBusy(false);
  };
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.menuSave({ id: item.id || null, category: f.category, name: f.name, about: f.about, price: Number(f.price), veg: f.veg, available: f.available, photo: f.photo }));
      if (r && r.ok) onSaved(); else setMsg(t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };
  const del = async () => { setBusy(true); try { await api.menuDelete(item.id); } catch (_) {} onSaved(); };
  const row = { marginBottom: 8 };
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 540, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, padding: "14px 18px calc(20px + env(safe-area-inset-bottom))", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0 }}>{item.id ? t("ow_edit") : t("ow_add")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ width: 72, height: 72, borderRadius: 12, background: f.photo ? `center/cover url(${f.photo}) ${T.line}` : T.brandSoft,
                         display: "flex", alignItems: "center", justifyContent: "center", color: T.brandDark }}>
            {!f.photo && <Icon name="camera" size={26} />}
          </span>
          <label style={{ color: T.brandDark, fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>
            {upBusy ? t("ow_uploading") : f.photo ? t("ow_photo_change") : t("ow_photo")}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pick(e.target.files && e.target.files[0])} />
          </label>
        </div>
        <input style={{ ...input, ...row }} value={f.name} maxLength={80} placeholder={t("ow_name")} aria-label={t("ow_name")} onChange={(e) => set("name", e.target.value)} />
        <input style={{ ...input, ...row }} value={f.price} inputMode="numeric" maxLength={5} placeholder={t("ow_price")} aria-label={t("ow_price")} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} />
        <input style={{ ...input, ...row }} value={f.category} maxLength={40} placeholder={t("ow_cat")} aria-label={t("ow_cat")} onChange={(e) => set("category", e.target.value)} />
        <input style={{ ...input, ...row }} value={f.about} maxLength={200} placeholder={t("ow_about")} aria-label={t("ow_about")} onChange={(e) => set("about", e.target.value)} />
        {!shop && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, fontSize: 15 }}>
            <input type="checkbox" checked={f.veg} onChange={(e) => set("veg", e.target.checked)} /> {t("ow_veg")}
          </label>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, fontSize: 15, marginBottom: 8 }}>
          <input type="checkbox" checked={f.available} onChange={(e) => set("available", e.target.checked)} /> {t("ow_avail")}
        </label>
        {msg && <div style={{ marginBottom: 8 }}><Notice tone="bad">{msg}</Notice></div>}
        <Btn full disabled={busy || f.name.trim().length < 2 || !f.price} onClick={save}>{busy ? "…" : t("ow_save")}</Btn>
        {item.id && <button onClick={del} disabled={busy} style={{ marginTop: 8, background: "none", border: "none", color: RED, fontWeight: 700, cursor: "pointer", minHeight: 44, fontFamily: "inherit" }}>{t("ow_delete")}</button>}
      </div>
    </div>
  );
}
