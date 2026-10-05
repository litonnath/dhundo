// ===========================================================================
// market.jsx -- Buy & Sell: people selling things they no longer need to
// people nearby. A local OLX inside Dhundo.
//
// Everything is decided by the database (84): who may post, the five-ad
// limit, banned items, three reports hiding an ad, the number shown only to
// signed-in buyers. This file only shows it and asks for it.
//
//   MarketPage   -- the Buy & Sell tab: its own search, categories, ads,
//                   and the Sell button
//   MarketHome   -- the ads themselves, nearest first
//   ItemDetail   -- one ad, full screen: photos, details, call, report
//   SellPage     -- post an ad, and manage your own
//   AdminAds     -- reported ads for the admin
// ===========================================================================
import React, { useState, useEffect, useMemo, useRef } from "react";
import { T, Icon, Btn, Notice, input, ConfirmDelete, CloseButton, useDismissable, VoiceButton, Hero } from "./ui.jsx";
import { useI18n, stateName } from "./i18n.jsx";
import { ITEM_CATEGORIES, itemCategoryFor } from "./itemwords.js";
import { hasIndic, variants } from "./translit.js";
import { useConsent } from "./consent-core.js";
import { TileArt } from "./scenes.jsx";
import { HomeButton } from "./start.jsx";

const NEAR_KM = 30;
const FAR_KM = 100;
const MAX_PHOTOS = 6;
const MAX_ADS = 5;
const WITH_YEAR = ["bikes", "cars", "mobiles", "electronics", "appliances", "tools"];
const WITH_KM = ["bikes", "cars"];

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const one = (r) => (Array.isArray(r) ? r[0] || null : r || null);
export const priceLabel = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const catOf = (key) => ITEM_CATEGORIES.find((c) => c.key === key) || ITEM_CATEGORIES[ITEM_CATEGORIES.length - 1];

function useAgo() {
  const { t } = useI18n();
  return (iso) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    if (m < 2) return t("mk_ago_now");
    if (m < 60) return t("mk_ago_min").replace("{n}", m);
    if (m < 60 * 24) return t("mk_ago_hr").replace("{n}", Math.round(m / 60));
    return t("mk_ago_day").replace("{n}", Math.round(m / 1440));
  };
}

function distLabel(t, km) {
  if (km === null || km === undefined || Number.isNaN(Number(km))) return null;
  const n = Number(km);
  return n < 1 ? t("dist_near") : t("dist_km").replace("{n}", n < 10 ? n.toFixed(1) : Math.round(n));
}

// A phone photo is 3-5 MB. Shrunk to 1280 px on the long side as JPEG it is
// about 200 KB and looks the same on a phone screen -- the difference
// between an upload that finishes on 3G and one that does not.
export async function shrink(file) {
  if (!file || !/^image\//.test(file.type) || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch (_) {
    return file;
  }
}

// Search in any script: Bengali or Hindi typed text becomes a few English
// spellings, and the results of each are merged.
async function browseAll(api, opts) {
  const q = (opts.q || "").trim();
  const qs = q && hasIndic(q) ? variants(q, 3) : [q];
  const lists = await Promise.all(qs.map((x) => api.itemsBrowse({ ...opts, q: x }).then(many).catch(() => [])));
  const seen = new Set();
  const out = [];
  lists.flat().forEach((r) => { if (!seen.has(r.id)) { seen.add(r.id); out.push(r); } });
  return out;
}

// Within NEAR_KM when there is anything; otherwise nearby towns, marked.
function splitNear(rows, hasPos) {
  if (!hasPos) return { rows, far: false };
  const near = rows.filter((r) => r.distance_km == null || Number(r.distance_km) <= NEAR_KM);
  if (near.length) return { rows: near, far: false };
  return { rows, far: rows.length > 0 };
}

// ------------------------------------------------------------------ pieces
function CatChips({ value, onChange, t }) {
  const chip = (key, emoji, label) => {
    const on = value === key;
    return (
      <button key={key || "all"} onClick={() => onChange(key)} style={{
        flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 13px", borderRadius: 22, cursor: "pointer", fontFamily: "inherit",
        fontSize: 14, fontWeight: on ? 800 : 600, whiteSpace: "nowrap", minHeight: 40,
        border: `1.5px solid ${on ? T.brandDark : T.line}`,
        background: on ? T.brandSoft : T.white, color: on ? T.brandDeep : T.ink,
      }}>
        {emoji && <span style={{ fontSize: 17, lineHeight: 1 }}>{emoji}</span>}{label}
      </button>
    );
  };
  return (
    <ScrollRow>
      {chip(null, null, t("all"))}
      {ITEM_CATEGORIES.map((c) => chip(c.key, c.emoji, t("mk_cat_" + c.key)))}
    </ScrollRow>
  );
}

// A row that scrolls sideways, with a round arrow at each end for a
// computer, where there is no swipe. An arrow shows only while there is
// more to see that way, and moves the row by most of its width.
export function ScrollRow({ children }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  // The chips can arrive after the first paint, so look again after every render.
  useEffect(measure);
  const go = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };
  const arrow = (dir) => (
    <button onClick={() => go(dir)} aria-label={dir < 0 ? "Scroll left" : "Scroll right"} style={{
      position: "absolute", top: "50%", [dir < 0 ? "left" : "right"]: -4, zIndex: 2,
      transform: "translateY(calc(-50% - 3px))", width: 38, height: 38, borderRadius: "50%",
      border: `1px solid ${T.line}`, background: T.white, color: T.brandDark, cursor: "pointer",
      boxShadow: "0 2px 10px rgba(15,20,25,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon name="back" size={18} style={dir > 0 ? { transform: "rotate(180deg)" } : undefined} />
    </button>
  );
  return (
    <div style={{ position: "relative" }}>
      {edge.left && arrow(-1)}
      <div ref={ref} onScroll={measure} style={{
        display: "flex", gap: 8, overflowX: "auto", padding: "2px 0 8px", scrollbarWidth: "none",
        // a soft fade at an end that has more, so the row reads as "keeps going"
        maskImage: `linear-gradient(90deg, ${edge.left ? "transparent 0, #000 40px" : "#000 0"}, ${edge.right ? "#000 calc(100% - 40px), transparent 100%" : "#000 100%"})`,
        WebkitMaskImage: `linear-gradient(90deg, ${edge.left ? "transparent 0, #000 40px" : "#000 0"}, ${edge.right ? "#000 calc(100% - 40px), transparent 100%" : "#000 100%"})`,
      }}>
        {children}
      </div>
      {edge.right && arrow(1)}
    </div>
  );
}

export function ItemCard({ item, onOpen, showStatus }) {
  const { t } = useI18n();
  const ago = useAgo();
  const c = catOf(item.category);
  const dist = distLabel(t, item.distance_km);
  const where = item.locality || item.city || "";
  return (
    <button onClick={() => onOpen(item)} style={{
      display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", textAlign: "left",
      borderRadius: 14, cursor: "pointer", background: T.white, border: `1px solid ${T.line}`,
      boxShadow: "0 2px 8px rgba(15,20,25,0.05)", fontFamily: "inherit", color: T.ink,
    }}>
      <span style={{
        position: "relative", display: "block", width: "100%", aspectRatio: "1 / 1",
        background: item.photo ? `center/cover url("${item.photo}") ${T.paper}` : T.paper,
      }}>
        {!item.photo && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                         justifyContent: "center", fontSize: 44 }}>{c.emoji}</span>
        )}
        {item.photo_count > 1 && (
          <span style={{
            position: "absolute", right: 7, bottom: 7, display: "inline-flex", alignItems: "center",
            gap: 3, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, fontWeight: 700,
            padding: "3px 7px", borderRadius: 10,
          }}><Icon name="camera" size={12} /> {item.photo_count}</span>
        )}
        {showStatus && item.status === "sold" && (
          <span style={{
            position: "absolute", inset: 0, background: "rgba(15,20,25,0.5)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, letterSpacing: 1,
          }}>{t("mk_sold_badge").toUpperCase()}</span>
        )}
      </span>
      <span style={{ display: "block", padding: "9px 10px 11px" }}>
        <span style={{ display: "block", fontSize: 17, fontWeight: 900 }}>{priceLabel(item.price)}</span>
        <span style={{
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, marginTop: 2, minHeight: 36,
        }}>{item.title}</span>
        <span style={{ display: "block", fontSize: 12, color: T.inkSoft, marginTop: 5,
                       whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[where, dist].filter(Boolean).join(" · ")}
        </span>
        <span style={{ display: "block", fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>
          {ago(item.created_at)}
        </span>
      </span>
    </button>
  );
}

const grid = {
  display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))",
};

// ------------------------------------------------------------ Buy & Sell tab
// Its own page, apart from the services: a search box for things, the
// categories, the ads nearest first, and one clear way to sell.
export function MarketPage({ api, place, state, onOpenItem, onSell, onBack }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  // "purana bike" or "পুরনো মোবাইল" is a category, not words to find in a
  // title; anything else is searched as typed.
  const typedCat = itemCategoryFor(q);
  // Worker-style: category tiles first, then the ads for the one you pick.
  const [catPick, setCatPick] = useState(undefined);
  const cat = typedCat || (catPick === undefined ? null : catPick);
  const showTiles = catPick === undefined && !q.trim();
  return (
    <div>
      {onBack && <div style={{ maxWidth: 1000, margin: "0 auto", padding: "10px 16px 0" }}><HomeButton onClick={onBack} /></div>}
      <Hero search={q} setSearch={setQ} onVoice={setQ} compact={!showTiles} tone="buy"
            title={t("need_buy")} sub={t("need_buy_sub")} placeholder={t("mk_search_ph")} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "62px 16px 60px" }}>
        {showTiles ? (
          <>
            <TileArt k="need-market" pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 280, marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "0 0 4px" }}>{t("need_buy")}</h2>
            <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 14px" }}>{t("what_need")}</p>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {[{ key: null, emoji: "🔎", label: t("st_all") }, ...ITEM_CATEGORIES.map((c) => ({ key: c.key, emoji: c.emoji, label: t("mk_cat_" + c.key) }))].map((c) => (
                <button key={c.key || "all"} onClick={() => setCatPick(c.key)} style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "12px", minHeight: 62, borderRadius: 12,
                  border: `1px solid ${c.key ? T.line : T.brandDark}`, background: c.key ? T.white : T.brandSoft, cursor: "pointer", fontFamily: "inherit",
                }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: "#F3E8FD", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.emoji}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{c.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {catPick !== undefined && !q.trim() && (
              <button onClick={() => setCatPick(undefined)} style={{
                display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
                color: T.brandDark, fontWeight: 700, fontSize: 14.5, padding: "0 0 10px", minHeight: 40, fontFamily: "inherit",
              }}><Icon name="back" size={17} /> {t("need_buy")}</button>
            )}
            <MarketHome api={api} place={place} state={state} query={q} category={cat}
                        onOpenItem={onOpenItem} onSell={onSell} />
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ the ads
export function MarketHome({ api, place, state, query = "", category: initialCat = null, onOpenItem, onSell }) {
  const { t } = useI18n();
  const [cat, setCat] = useState(initialCat);
  const [sort, setSort] = useState("near");
  const [rows, setRows] = useState([]);
  const [far, setFar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(30);
  const hasPos = typeof (place && place.lat) === "number";

  useEffect(() => { setCat(initialCat); }, [initialCat]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      const base = {
        lat: hasPos ? place.lat : null, lng: hasPos ? place.lng : null, state,
        category: cat, q: query, sort, radiusKm: FAR_KM, limit,
      };
      // "hero splendor" finds that bike; "purana bike" matches no title, so
      // it falls back to every bike.
      browseAll(api, base).then((r) =>
        r.length || !query || !cat || cat !== initialCat ? r : browseAll(api, { ...base, q: "" })
      ).then((r) => {
        if (!alive) return;
        const s = splitNear(r, hasPos && sort === "near");
        setRows(s.rows); setFar(s.far); setLoading(false);
      });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [api, cat, sort, query, state, limit, hasPos, place && place.lat, place && place.lng, initialCat]);

  const total = rows.length ? Number(rows[0].total_count || rows.length) : 0;

  return (
    <div>
      <CatChips value={cat} onChange={(k) => { setCat(k); setLimit(30); }} t={t} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, flex: 1, minWidth: 160 }}>
          {far ? t("mk_far_title").replace("{n}", NEAR_KM) : t("mk_near")}
        </h2>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" style={{
          ...input, width: "auto", minHeight: 40, padding: "7px 10px", fontSize: 13.5, fontWeight: 700,
        }}>
          <option value="near">{t("mk_sort_near")}</option>
          <option value="new">{t("mk_sort_new")}</option>
          <option value="price_low">{t("mk_sort_low")}</option>
          <option value="price_high">{t("mk_sort_high")}</option>
        </select>
      </div>
      {far && <p style={{ fontSize: 13.5, color: T.inkSoft, margin: "-6px 0 12px" }}>{t("mk_far_note")}</p>}

      {loading && !rows.length ? (
        <div style={grid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ borderRadius: 14, background: T.white, border: `1px solid ${T.line}`, height: 250 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "34px 18px", background: T.white, borderRadius: 16,
          border: `1px dashed ${T.line}`,
        }}>
          <div style={{ fontSize: 40 }}>{cat ? catOf(cat).emoji : "🛍️"}</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 6 }}>{t("mk_empty")}</div>
          <p style={{ fontSize: 14, color: T.inkSoft, margin: "6px 0 16px", lineHeight: 1.55 }}>{t("st_none")}</p>
          {onSell && <Btn onClick={onSell}><Icon name="tag" size={18} /> {t("mk_sell_title")}</Btn>}
        </div>
      ) : (
        <>
          <div style={grid}>
            {rows.map((it) => <ItemCard key={it.id} item={it} onOpen={onOpenItem} />)}
          </div>
          {total > rows.length && !far && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <Btn kind="ghost" onClick={() => setLimit((n) => Math.min(60, n + 30))}>{t("mk_more")}</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------- one ad
export function ItemDetail({ api, id, distanceKm = null, user, onClose, onSignIn, onEdit }) {
  const { t, lang } = useI18n();
  const ago = useAgo();
  useDismissable(true, onClose);
  const [it, setIt] = useState(null);
  const [gone, setGone] = useState(false);
  const [phone, setPhone] = useState(null);
  const [wa, setWa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [photoIx, setPhotoIx] = useState(0);
  const strip = useRef(null);

  useEffect(() => {
    let alive = true;
    api.itemGet(id).then((r) => {
      if (!alive) return;
      const v = one(r);
      if (!v || !v.id) setGone(true); else setIt(v);
    }).catch(() => alive && setGone(true));
    return () => { alive = false; };
  }, [api, id]);

  const reveal = async () => {
    if (!user) { onSignIn(); return; }
    setBusy(true); setNote(null);
    try {
      const r = one(await api.itemReveal(id));
      if (r && r.ok) {
        setPhone(r.phone); setWa(!!r.whatsapp);
        try { window.location.href = `tel:${r.phone}`; } catch (_) {}
      } else {
        setNote(r && r.reason === "rate_limited" ? t("e_rate")
          : r && r.reason === "sign_in_required" ? t("e_signin") : t("mk_e_gone"));
      }
    } catch (_) { setNote(t("mk_e_gone")); }
    finally { setBusy(false); }
  };

  const share = async () => {
    const url = `${window.location.origin}/?item=${id}`;
    const text = it ? `${it.title} – ${priceLabel(it.price)} on Dhundo` : "Dhundo";
    try {
      if (navigator.share) await navigator.share({ title: text, text, url });
      else { await navigator.clipboard.writeText(url); setNote(t("mk_copied")); }
    } catch (_) {}
  };

  const waHref = phone && it
    ? `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(t("mk_wa_msg").replace("{t}", it.title))}`
    : null;
  const photos = (it && it.photos) || [];
  const c = it ? catOf(it.category) : null;
  const dist = distLabel(t, distanceKm);
  const since = it && it.seller_since
    ? new Date(it.seller_since).toLocaleDateString(lang === "en" ? "en-IN" : lang + "-IN", { month: "short", year: "numeric" })
    : null;
  const facts = it ? [
    [t("mk_condition"), t("mk_cond_" + it.condition)],
    it.brand && [t("mk_brand"), it.brand],
    it.model_year && [t("mk_year"), String(it.model_year)],
    it.km_driven != null && [t("mk_km"), Number(it.km_driven).toLocaleString("en-IN")],
    [t("mk_category"), `${c.emoji} ${t("mk_cat_" + c.key)}`],
  ].filter(Boolean) : [];

  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, zIndex: 250, background: T.paper, overflowY: "auto",
    }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", gap: 6,
        padding: "6px 8px", background: T.white, borderBottom: `1px solid ${T.line}`,
      }}>
        <button onClick={onClose} aria-label={t("w_back")} style={{
          width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: T.ink,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon name="back" size={22} /></button>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {it ? it.title : ""}
        </span>
        <button onClick={share} aria-label={t("mk_share")} style={{
          width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: T.brandDark,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon name="share" size={21} /></button>
      </div>

      {gone ? (
        <div style={{ maxWidth: 560, margin: "40px auto", padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 42 }}>🛍️</div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{t("mk_e_gone")}</p>
          <Btn onClick={onClose}>{t("w_back")}</Btn>
        </div>
      ) : !it ? (
        <div style={{ maxWidth: 560, margin: "0 auto", aspectRatio: "1 / 1", background: T.white }} />
      ) : (
        <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 110 }}>
          {/* Photos: swipe sideways, a counter in the corner. */}
          <div style={{ position: "relative", background: "#111" }}>
            <div ref={strip}
                 onScroll={(e) => setPhotoIx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
                 style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
              {photos.map((src, i) => (
                <img key={src + i} src={src} alt="" loading={i ? "lazy" : "eager"} style={{
                  flex: "0 0 100%", width: "100%", aspectRatio: "1 / 1", objectFit: "contain",
                  scrollSnapAlign: "start", background: "#111",
                }} />
              ))}
            </div>
            {photos.length > 1 && (
              <span style={{
                position: "absolute", right: 10, bottom: 10, background: "rgba(0,0,0,0.6)", color: "#fff",
                fontSize: 12.5, fontWeight: 700, padding: "4px 9px", borderRadius: 12,
              }}>{photoIx + 1} / {photos.length}</span>
            )}
            {it.status === "sold" && (
              <span style={{
                position: "absolute", left: 10, top: 10, background: T.red, color: "#fff",
                fontSize: 13, fontWeight: 900, padding: "5px 11px", borderRadius: 8,
              }}>{t("mk_sold_badge").toUpperCase()}</span>
            )}
          </div>

          <div style={{ background: T.white, padding: "16px 16px 14px", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 28, fontWeight: 900 }}>{priceLabel(it.price)}</span>
              <span style={{
                fontSize: 12.5, fontWeight: 800, padding: "3px 9px", borderRadius: 8,
                color: it.negotiable ? T.green : T.inkSoft, background: it.negotiable ? T.greenSoft : T.paper,
              }}>{it.negotiable ? t("mk_negotiable") : t("mk_fixed")}</span>
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: "6px 0 10px", lineHeight: 1.35 }}>{it.title}</h1>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: T.inkSoft }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="pin" size={15} />
                {[it.locality, it.city, stateName(it.state, lang)].filter(Boolean).join(", ")}
                {dist && <b style={{ color: T.brandDark }}>&nbsp;· {dist}</b>}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="clock" size={15} /> {ago(it.created_at)}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="eye" size={15} /> {t("mk_views").replace("{n}", it.views || 0)}
              </span>
            </div>
          </div>

          <div style={{ background: T.white, marginTop: 8, padding: "6px 16px" }}>
            {facts.map(([k, v]) => (
              <div key={k} style={{ display: "flex", padding: "10px 0", borderBottom: `1px solid ${T.line}`, fontSize: 14.5 }}>
                <span style={{ flex: "0 0 42%", color: T.inkSoft }}>{k}</span>
                <span style={{ fontWeight: 700 }}>{v}</span>
              </div>
            ))}
            {it.description && (
              <div style={{ padding: "12px 0 8px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                  {t("mk_desc")}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{it.description}</div>
              </div>
            )}
          </div>

          <div style={{ background: T.white, marginTop: 8, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{
              width: 48, height: 48, borderRadius: "50%", background: T.brandDark, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, flexShrink: 0,
            }}>{(it.seller_name || "?").charAt(0).toUpperCase()}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 800 }}>{it.seller_name || t("mk_seller")}</span>
              <span style={{ display: "block", fontSize: 13, color: T.inkSoft }}>
                {[since && t("mk_member_since").replace("{d}", since),
                  t("mk_seller_ads").replace("{n}", it.seller_ads || 0)].filter(Boolean).join(" · ")}
              </span>
            </span>
          </div>

          <div style={{ margin: "8px 12px 0", background: "#FFF8E6", border: "1px solid rgba(178,106,0,0.25)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.amber, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="alert" size={17} /> {t("mk_safety_title")}
            </div>
            {["mk_safety_1", "mk_safety_2", "mk_safety_3"].map((k) => (
              <div key={k} style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, paddingLeft: 4 }}>• {t(k)}</div>
            ))}
          </div>

          {!it.mine && (
            <div style={{ textAlign: "center", margin: "14px 0" }}>
              <button onClick={() => (user ? setReporting(true) : onSignIn())} style={{
                background: "none", border: "none", color: T.red, fontWeight: 700, fontSize: 14,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44,
                fontFamily: "inherit",
              }}><Icon name="flag" size={16} /> {t("mk_report")}</button>
            </div>
          )}
          {note && <div style={{ margin: "0 12px" }}><Notice tone="info">{note}</Notice></div>}
        </div>
      )}

      {/* The actions, always within reach of a thumb. */}
      {it && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 3, background: T.white,
          borderTop: `1px solid ${T.line}`, padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
          boxShadow: "0 -4px 18px rgba(15,20,25,0.08)",
        }}>
          <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", gap: 9 }}>
            {it.mine ? (
              <>
                <span style={{ flex: 1, alignSelf: "center", fontSize: 14, fontWeight: 700, color: T.inkSoft }}>{t("mk_mine")}</span>
                <Btn onClick={() => onEdit(it.id)}><Icon name="edit" size={17} /> {t("mk_edit")}</Btn>
              </>
            ) : it.status === "sold" ? (
              <span style={{ flex: 1, textAlign: "center", fontWeight: 800, color: T.red, padding: 12 }}>{t("mk_sold_badge")}</span>
            ) : phone ? (
              <>
                <a href={`tel:${phone}`} style={{
                  flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: T.green, color: "#fff", borderRadius: 12, fontWeight: 800, fontSize: 16,
                  textDecoration: "none", minHeight: 52,
                }}><Icon name="phone" size={18} /> {phone.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2")}</a>
                {wa && waHref && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: "#25D366", color: "#fff", borderRadius: 12, fontWeight: 800, fontSize: 15,
                    textDecoration: "none", minHeight: 52, padding: "0 16px",
                  }}>WhatsApp</a>
                )}
              </>
            ) : (
              <Btn kind="call" full onClick={reveal} disabled={busy} style={{ minHeight: 52, fontSize: 16.5, borderRadius: 12 }}>
                <Icon name="phone" size={18} /> {busy ? "…" : user ? t("mk_call") : t("mk_signin_call")}
              </Btn>
            )}
          </div>
        </div>
      )}

      {reporting && <ReportSheet api={api} id={id} onClose={(done) => { setReporting(false); if (done) setNote(t("mk_reported")); }} />}
    </div>
  );
}

function ReportSheet({ api, id, onClose }) {
  const { t } = useI18n();
  useDismissable(true, () => onClose(false));
  const [reason, setReason] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const reasons = ["fraud", "sold", "wrong", "not_allowed", "offensive", "duplicate", "other"];
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = one(await api.itemReport(id, reason, text));
      if (r && r.ok) onClose(true); else setErr(t("e_save"));
    } catch (_) { setErr(t("e_save")); } finally { setBusy(false); }
  };
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(false); }} style={{
      position: "fixed", inset: 0, zIndex: 320, background: "rgba(15,20,25,0.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460,
        padding: "18px 18px calc(20px + env(safe-area-inset-bottom))", maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>{t("mk_report_title")}</span>
          <CloseButton onClick={() => onClose(false)} />
        </div>
        {reasons.map((r) => (
          <label key={r} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", borderRadius: 10,
            cursor: "pointer", background: reason === r ? T.brandSoft : "transparent", fontSize: 15,
          }}>
            <input type="radio" name="rep" checked={reason === r} onChange={() => setReason(r)} style={{ width: 18, height: 18 }} />
            {t("mk_r_" + r)}
          </label>
        ))}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
                  placeholder={t("mk_report_note")} style={{ ...input, minHeight: 70, marginTop: 8, resize: "vertical" }} />
        {err && <div style={{ marginTop: 10 }}><Notice tone="bad">{err}</Notice></div>}
        <Btn full onClick={send} disabled={!reason || busy} style={{ marginTop: 12, minHeight: 50, background: T.red }}>
          {busy ? "…" : t("mk_report_send")}
        </Btn>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- selling
export function SellPage({ api, user, place, onSignIn, onPickLocation, onOpenItem, editId, setEditId, onBack }) {
  const { t } = useI18n();
  const [mode, setMode] = useState(editId ? "edit" : "list");
  const [mine, setMine] = useState(null);
  const [reload, setReload] = useState(0);
  const [flash, setFlash] = useState(null);

  useEffect(() => { if (editId) setMode("edit"); }, [editId]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    api.myItems().then((r) => alive && setMine(many(r))).catch(() => alive && setMine([]));
    return () => { alive = false; };
  }, [api, user, reload]);

  if (!user) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px 40px" }}>
        <div style={{ fontSize: 44 }}>🛍️</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0" }}>{t("mk_sell_title")}</h1>
        <p style={{ fontSize: 15, color: T.inkSoft, lineHeight: 1.6 }}>{t("mk_need_signin")}</p>
        <Btn onClick={onSignIn} style={{ minHeight: 52, fontSize: 16 }}><Icon name="user" size={18} /> {t("nav_signin")}</Btn>
      </div>
    );
  }

  if (mode === "new" || mode === "edit") {
    return (
      <SellForm api={api} user={user} place={place} editId={mode === "edit" ? editId : null}
                onPickLocation={onPickLocation}
                onCancel={() => { setMode("list"); setEditId && setEditId(null); }}
                onDone={(msg) => { setMode("list"); setEditId && setEditId(null); setFlash(msg); setReload((n) => n + 1); }} />
    );
  }

  const active = (mine || []).filter((m) => m.status === "active" && !m.expired).length;
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "10px 16px 40px" }}>
      {onBack && <HomeButton onClick={onBack} label={t("nav_dash")} />}
      <TileArt k="sell" pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 280, margin: "10px 0 16px" }} />
      <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 4px" }}>{t("mk_sell_title")}</h1>
      <p style={{ fontSize: 14.5, color: T.inkSoft, margin: "0 0 16px", lineHeight: 1.55 }}>{t("mk_sell_sub")}</p>
      {flash && <Notice tone="good">{flash}</Notice>}
      <Btn full onClick={() => { setFlash(null); setMode("new"); }} disabled={active >= MAX_ADS}
           style={{ minHeight: 56, fontSize: 17, borderRadius: 14 }}>
        <Icon name="plus" size={20} /> {t("mk_new_ad")}
      </Btn>
      <p style={{ fontSize: 13, color: active >= MAX_ADS ? T.red : T.inkFaint, textAlign: "center", margin: "8px 0 22px" }}>
        {active >= MAX_ADS ? t("mk_e_limit") : t("mk_count").replace("{n}", active)}
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>{t("mk_my_ads")}</h2>
      {mine === null ? (
        <div style={{ height: 90, background: T.white, borderRadius: 14 }} />
      ) : mine.length === 0 ? (
        <p style={{ fontSize: 14, color: T.inkSoft }}>{t("mk_no_ads")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mine.map((m) => (
            <MyAdRow key={m.id} api={api} item={m} onOpen={() => onOpenItem({ id: m.id })}
                     onEdit={() => { setEditId && setEditId(m.id); setMode("edit"); }}
                     onChanged={(msg) => { setFlash(msg || null); setReload((n) => n + 1); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function MyAdRow({ api, item, onOpen, onEdit, onChanged }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const daysLeft = Math.max(0, Math.ceil((new Date(item.expires_at) - Date.now()) / 86400000));
  const status = item.hidden ? ["mk_st_hidden", T.red, T.redSoft]
    : item.status === "sold" ? ["mk_st_sold", T.inkSoft, T.paper]
    : item.expired ? ["mk_st_expired", T.amber, "#FFF5E0"]
    : ["mk_st_active", T.green, T.greenSoft];
  const act = async (action) => {
    setBusy(true);
    try {
      const r = one(await api.itemSetStatus(item.id, action));
      if (r && r.ok) onChanged();
      else onChanged(r && r.reason === "limit" ? t("mk_e_limit") : t("e_save"));
    } catch (_) { onChanged(t("e_save")); } finally { setBusy(false); setConfirm(false); }
  };
  const small = { minHeight: 38, padding: "0 12px", fontSize: 13.5, borderRadius: 9 };
  return (
    <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12 }}>
      <button onClick={onOpen} style={{
        display: "flex", gap: 12, width: "100%", background: "none", border: "none", padding: 0,
        cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: T.ink,
      }}>
        <span style={{
          width: 72, height: 72, borderRadius: 11, flexShrink: 0,
          background: item.photos && item.photos[0] ? `center/cover url("${item.photos[0]}")` : T.paper,
        }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 16, fontWeight: 900 }}>{priceLabel(item.price)}</span>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
          <span style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: status[1], background: status[2], padding: "2px 8px", borderRadius: 7 }}>
              {t(status[0])}
            </span>
            {item.status === "active" && !item.expired && !item.hidden && (
              <span style={{ fontSize: 12, color: T.inkFaint }}>{t("mk_st_expires").replace("{n}", daysLeft)}</span>
            )}
            <span style={{ fontSize: 12, color: T.inkFaint, display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Icon name="eye" size={13} /> {item.views || 0}
            </span>
          </span>
        </span>
      </button>
      <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
        {item.status === "active" && !item.expired && !item.hidden && (
          <Btn kind="ghost" disabled={busy} onClick={() => act("sold")} style={small}>✓ {t("mk_mark_sold")}</Btn>
        )}
        {(item.status === "sold" || item.expired) && !item.hidden && (
          <Btn kind="ghost" disabled={busy} onClick={() => act("active")} style={small}>↻ {t("mk_relist")}</Btn>
        )}
        <Btn kind="ghost" disabled={busy} onClick={onEdit} style={small}><Icon name="edit" size={15} /> {t("mk_edit")}</Btn>
        <Btn kind="ghost" disabled={busy} onClick={() => setConfirm(true)} style={{ ...small, color: T.red }}>
          <Icon name="trash" size={15} /> {t("mk_delete")}
        </Btn>
      </div>
      {confirm && (
        <ConfirmDelete title={t("mk_del_title")} body={t("mk_del_body")} busy={busy}
                       onCancel={() => setConfirm(false)} onConfirm={() => act("delete")} />
      )}
    </div>
  );
}

function SellForm({ api, user, place, editId, onPickLocation, onCancel, onDone }) {
  const consent = useConsent();
  const { t, lang } = useI18n();
  const [f, setF] = useState({
    category: null, title: "", price: "", negotiable: true, condition: "used",
    brand: "", model_year: "", km_driven: "", description: "", whatsapp: true, photos: [],
  });
  const [loaded, setLoaded] = useState(!editId);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const set = (k, v) => { setErr(null); setF((p) => ({ ...p, [k]: v })); };

  useEffect(() => {
    if (!editId) return;
    api.itemGet(editId).then((r) => {
      const v = one(r);
      if (v) setF({
        category: v.category, title: v.title || "", price: String(v.price ?? ""),
        negotiable: !!v.negotiable, condition: v.condition || "used", brand: v.brand || "",
        model_year: v.model_year ? String(v.model_year) : "", km_driven: v.km_driven != null ? String(v.km_driven) : "",
        description: v.description || "", whatsapp: v.whatsapp !== false, photos: v.photos || [],
        state: v.state, locality: v.locality, city: v.city, lat: v.lat, lng: v.lng,
      });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [api, editId]);

  // Where the ad is: the place the person has set in the header, or, when
  // editing, where it already was until they change the place.
  const where = editId && f.state && !f._moved
    ? { area: f.locality || f.city || "", state: f.state, lat: f.lat, lng: f.lng }
    : place;
  const prevPlace = useRef(place);
  useEffect(() => {
    if (prevPlace.current !== place && editId) setF((p) => ({ ...p, _moved: true }));
    prevPlace.current = place;
  }, [place, editId]);

  const addPhotos = async (files) => {
    const room = MAX_PHOTOS - f.photos.length;
    const list = Array.from(files || []).slice(0, room);
    if (!list.length) return;
    setUploading((n) => n + list.length); setErr(null);
    for (const file of list) {
      try {
        const small = await shrink(file);
        const url = await api.uploadPublic("services-photos", small);
        setF((p) => ({ ...p, photos: [...p.photos, url].slice(0, MAX_PHOTOS) }));
      } catch (_) {
        setErr(t("mk_e_upload"));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  const movePhoto = (i) => setF((p) => {
    const ph = [...p.photos]; const [x] = ph.splice(i, 1); ph.unshift(x); return { ...p, photos: ph };
  });
  const dropPhoto = (i) => setF((p) => ({ ...p, photos: p.photos.filter((_, j) => j !== i) }));

  const submit = async () => {
    if (!f.photos.length) return setErr(t("mk_e_photos"));
    if (!f.category) return setErr(t("mk_e_category"));
    if (f.title.trim().length < 3) return setErr(t("mk_e_title"));
    if (f.price === "" || Number.isNaN(Number(f.price))) return setErr(t("mk_e_price"));
    if (!where || !where.state) return setErr(t("mk_e_state"));
    if (!(await consent.ask("market"))) return;
    setBusy(true); setErr(null);
    try {
      const num = (v) => (String(v).trim() === "" ? null : Math.round(Number(v)));
      const r = one(await api.itemSave({
        id: editId || null, title: f.title.trim(), description: f.description.trim(),
        category: f.category, price: Math.round(Number(f.price)), negotiable: f.negotiable,
        condition: f.condition, brand: f.brand.trim(),
        model_year: WITH_YEAR.includes(f.category) ? num(f.model_year) : null,
        km_driven: WITH_KM.includes(f.category) ? num(f.km_driven) : null,
        photos: f.photos, state: where.state, city: null, locality: where.area || null,
        lat: typeof where.lat === "number" ? where.lat : null,
        lng: typeof where.lng === "number" ? where.lng : null, whatsapp: f.whatsapp,
      }));
      if (r && r.ok) onDone(editId ? t("p_saved") : t("mk_posted_ok"));
      else {
        const m = { limit: "mk_e_limit", not_allowed: "mk_e_not_allowed", bad_title: "mk_e_title",
                    bad_price: "mk_e_price", bad_photos: "mk_e_photos", bad_state: "mk_e_state" };
        setErr(t(m[r && r.reason] || "e_save"));
      }
    } catch (_) { setErr(t("e_save")); } finally { setBusy(false); }
  };

  const field = { ...input, minHeight: 52, fontSize: 16, padding: "13px 14px", borderRadius: 11 };
  const label = (text, hint) => (
    <div style={{ margin: "18px 0 8px" }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{text}</div>
      {hint && <div style={{ fontSize: 12.5, color: T.inkFaint, marginTop: 2 }}>{hint}</div>}
    </div>
  );
  const years = useMemo(() => {
    const y = new Date().getFullYear(); return Array.from({ length: 40 }, (_, i) => y - i);
  }, []);

  if (!loaded) return <div style={{ maxWidth: 560, margin: "30px auto", height: 200, background: T.white, borderRadius: 16 }} />;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 16px 40px" }}>
      <button onClick={onCancel} style={{
        display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
        color: T.brandDark, fontSize: 15, fontWeight: 700, cursor: "pointer", padding: "6px 0", fontFamily: "inherit",
      }}><Icon name="back" size={18} /> {t("w_back")}</button>
      <h1 style={{ fontSize: 23, fontWeight: 800, margin: "4px 0 0" }}>{editId ? t("mk_edit") : t("mk_new_ad")}</h1>

      {label(t("mk_photos"), t("mk_photos_hint"))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {f.photos.map((src, i) => (
          <div key={src} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 11, overflow: "hidden",
                                  background: `center/cover url("${src}") ${T.paper}`, border: `1px solid ${T.line}` }}>
            {i === 0 ? (
              <span style={{ position: "absolute", left: 5, bottom: 5, background: T.brandDark, color: "#fff",
                             fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 6 }}>{t("mk_cover")}</span>
            ) : (
              <button onClick={() => movePhoto(i)} style={{
                position: "absolute", left: 5, bottom: 5, background: "rgba(0,0,0,0.55)", color: "#fff",
                fontSize: 10.5, fontWeight: 700, padding: "3px 7px", borderRadius: 6, border: "none", cursor: "pointer",
              }}>{t("mk_make_cover")}</button>
            )}
            <button onClick={() => dropPhoto(i)} aria-label={t("mk_delete")} style={{
              position: "absolute", right: 4, top: 4, width: 30, height: 30, borderRadius: "50%",
              background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Icon name="close" size={15} /></button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={"u" + i} style={{ aspectRatio: "1 / 1", borderRadius: 11, background: T.paper, border: `1px dashed ${T.line}`,
                                       display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.inkFaint }}>
            {t("mk_uploading")}
          </div>
        ))}
        {f.photos.length + uploading < MAX_PHOTOS && (
          <button onClick={() => fileRef.current && fileRef.current.click()} style={{
            aspectRatio: "1 / 1", borderRadius: 11, border: `2px dashed ${T.brand}`, background: T.brandSoft,
            color: T.brandDark, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 4, fontFamily: "inherit", fontWeight: 800, fontSize: 13,
          }}><Icon name="camera" size={26} />{t("mk_add_photo")}</button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden
             onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />

      {label(t("mk_category"))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {ITEM_CATEGORIES.map((c) => {
          const on = f.category === c.key;
          return (
            <button key={c.key} onClick={() => set("category", c.key)} style={{
              padding: "10px 4px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
              border: `2px solid ${on ? T.brandDark : T.line}`, background: on ? T.brandSoft : T.white,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              fontSize: 12.5, fontWeight: on ? 800 : 600, color: on ? T.brandDeep : T.ink, lineHeight: 1.2,
            }}><span style={{ fontSize: 26 }}>{c.emoji}</span>{t("mk_cat_" + c.key)}</button>
          );
        })}
      </div>

      {label(t("mk_title"))}
      <input style={field} value={f.title} maxLength={80} placeholder={t("mk_title_ph")}
             onChange={(e) => set("title", e.target.value)} />

      {label(t("mk_price"))}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 170px" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 800, color: T.inkSoft }}>₹</span>
          <input style={{ ...field, paddingLeft: 30, fontWeight: 800 }} inputMode="numeric" value={f.price}
                 onChange={(e) => set("price", e.target.value.replace(/\D/g, "").slice(0, 9))} />
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={f.negotiable} onChange={(e) => set("negotiable", e.target.checked)}
                 style={{ width: 20, height: 20 }} />
          {t("mk_negotiable")}
        </label>
      </div>

      {label(t("mk_condition"))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["new", "like_new", "used", "for_parts"].map((c) => {
          const on = f.condition === c;
          return (
            <button key={c} onClick={() => set("condition", c)} style={{
              padding: "10px 14px", borderRadius: 22, cursor: "pointer", fontFamily: "inherit", minHeight: 42,
              border: `1.5px solid ${on ? T.brandDark : T.line}`, background: on ? T.brandSoft : T.white,
              fontSize: 14, fontWeight: on ? 800 : 600, color: on ? T.brandDeep : T.ink,
            }}>{t("mk_cond_" + c)}</button>
          );
        })}
      </div>

      {label(t("mk_brand") + ` (${t("optional")})`)}
      <input style={field} value={f.brand} maxLength={60} onChange={(e) => set("brand", e.target.value)} />

      {WITH_YEAR.includes(f.category) && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}>
            {label(t("mk_year") + ` (${t("optional")})`)}
            <select style={field} value={f.model_year} onChange={(e) => set("model_year", e.target.value)}>
              <option value="">—</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {WITH_KM.includes(f.category) && (
            <div style={{ flex: "1 1 150px" }}>
              {label(t("mk_km") + ` (${t("optional")})`)}
              <input style={field} inputMode="numeric" value={f.km_driven}
                     onChange={(e) => set("km_driven", e.target.value.replace(/\D/g, "").slice(0, 7))} />
            </div>
          )}
        </div>
      )}

      {label(t("mk_desc") + ` (${t("optional")})`)}
      <textarea style={{ ...field, minHeight: 110, resize: "vertical", lineHeight: 1.55 }} value={f.description}
                maxLength={2000} placeholder={t("mk_desc_ph")} onChange={(e) => set("description", e.target.value)} />

      {label(t("mk_location"))}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.white, border: `1px solid ${T.line}`,
                    borderRadius: 11, padding: "10px 12px" }}>
        <Icon name="pin" size={19} style={{ color: T.brandDark }} />
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>
          {[where && where.area, where && stateName(where.state, lang)].filter(Boolean).join(", ") || "—"}
        </span>
        <Btn kind="ghost" onClick={onPickLocation} style={{ minHeight: 38, padding: "0 12px", fontSize: 13.5 }}>{t("mk_change")}</Btn>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 0", fontSize: 15, cursor: "pointer" }}>
        <input type="checkbox" checked={f.whatsapp} onChange={(e) => set("whatsapp", e.target.checked)} style={{ width: 20, height: 20 }} />
        {t("mk_wa_ok")}
      </label>

      <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.55, margin: "18px 0 12px", background: T.paper,
                  padding: "10px 12px", borderRadius: 10 }}>{t("mk_rules")}</p>
      {err && <Notice tone="bad">{err}</Notice>}
      <Btn full onClick={submit} disabled={busy || uploading > 0} style={{ minHeight: 56, fontSize: 17, borderRadius: 14 }}>
        {busy ? "…" : editId ? t("mk_save") : t("mk_post")}
      </Btn>
    </div>
  );
}

// ------------------------------------------------------------------ admin
export function AdminAds({ api, onOpenItem }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("reported");
  const [rows, setRows] = useState(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setRows(null);
    api.adminItems(filter).then((r) => alive && setRows(many(r))).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [api, filter, n]);
  const act = async (id, a) => { try { await api.adminItemAction(id, a); } finally { setN((x) => x + 1); } };
  const tab = (k, label) => (
    <button onClick={() => setFilter(k)} style={{
      padding: "8px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
      border: `1.5px solid ${filter === k ? T.brandDark : T.line}`, background: filter === k ? T.brandSoft : T.white,
    }}>{label}</button>
  );
  const small = { minHeight: 36, padding: "0 12px", fontSize: 13, borderRadius: 9 };
  return (
    <div style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 10px" }}>🛍️ {t("mk_adm_title")}</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {tab("reported", t("mk_adm_reported"))}{tab("removed", t("mk_adm_removed"))}{tab("all", t("mk_adm_all"))}
      </div>
      {rows === null ? <div style={{ height: 80 }} /> : rows.length === 0 ? (
        <p style={{ color: T.inkSoft }}>{t("mk_adm_none")}</p>
      ) : rows.map((r) => (
        <div key={r.id} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0,
                           background: r.photos && r.photos[0] ? `center/cover url("${r.photos[0]}")` : T.paper }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{priceLabel(r.price)}</b> · {r.title}
              <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft }}>
                {r.seller_name} · +{r.seller_phone} · {r.status}{r.hidden ? " · hidden" : ""} · {r.report_count} reports
              </span>
              {(r.reasons || []).map((x, i) => (
                <span key={i} style={{ display: "block", fontSize: 12.5, color: T.red }}>
                  {t("mk_r_" + x.reason)}{x.note ? ` — ${x.note}` : ""}
                </span>
              ))}
            </span>
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
            <Btn kind="ghost" onClick={() => onOpenItem({ id: r.id })} style={small}>{t("mk_open")}</Btn>
            {r.status !== "removed" && <Btn kind="ghost" onClick={() => act(r.id, "remove")} style={{ ...small, color: T.red }}>{t("mk_adm_remove")}</Btn>}
            {(r.hidden || r.status === "removed") && <Btn kind="ghost" onClick={() => act(r.id, "restore")} style={small}>{t("mk_adm_restore")}</Btn>}
            <Btn kind="ghost" onClick={() => act(r.id, "delete")} style={{ ...small, color: T.red }}>{t("mk_delete")}</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}
