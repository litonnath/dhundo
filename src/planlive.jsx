// MAP FOR A SCHEDULED RIDE, for the customer and the rider alike: the pickup, the destination, the road
// between them, and (while the trip is near) each other's live position. Each side shares its own phone
// location while the map is open and sharing is on; the other side sees it move.
import React, { useEffect, useRef, useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { UberMap, useRoadRoute, kmBetween, RouteNav } from "./nearmap.jsx";
import { searchAnywhere } from "./regions.js";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const fmt = (km) => (km < 1 ? `${Math.max(50, Math.round(km * 10) * 100)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

// The road for a pickup and a destination, used both here and in the booking sheet.
export function RoutePreviewMap({ pick, drop, height = "34vh", info = false, labels = null }) {
  const { t } = useI18n();
  const rt = useRoadRoute(pick, drop);
  if (!pick || !drop) return null;
  const markers = [{ id: "a", kind: "pickup", lat: pick.lat, lng: pick.lng, label: labels ? labels[0] : "" }, { id: "b", kind: "drop", lat: drop.lat, lng: drop.lng, label: labels ? labels[1] : "" }];
  return (
    <div>
      <UberMap markers={markers} lines={rt ? [{ pts: rt.pts }] : []} height={height} fitKey={rt ? "r" : "l"} />
      {info && <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, margin: "6px 0 2px" }}>{rt ? `${rt.km < 10 ? rt.km.toFixed(1) : Math.round(rt.km)} km ${t("pl_by_road")} \u00B7 ${rt.min} ${t("nav_min")}` : t("rdv_road_wait")}</div>}
    </div>
  );
}

// The work place of a hire booking, as the owner of the vehicle sees it: the pin, the road from where
// he is now (his phone), the distance and the time, and the full-screen directions.
export function WorkSiteMap({ site, address }) {
  const { t } = useI18n();
  const [me, setMe] = useState(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (!geo) return undefined;
    let dead = false;
    geo.getCurrentPosition((g) => { if (!dead) setMe({ lat: g.coords.latitude, lng: g.coords.longitude }); }, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    return () => { dead = true; };
  }, []);
  const rt = useRoadRoute(me, site);
  const markers = [{ id: "w", kind: "drop", lat: site.lat, lng: site.lng, label: t("pl_work_site") }];
  if (me) markers.push({ id: "me", kind: "me", lat: me.lat, lng: me.lng });
  return (
    <div style={{ padding: "4px 0 8px" }}>
      {full && <RouteNav from={me} to={site} title={t("rdv_to_drop")} onClose={() => setFull(false)} />}
      <UberMap markers={markers} lines={rt ? [{ pts: rt.pts }] : []} height="30vh" fitKey={`${!!me}${!!rt}`} />
      <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, margin: "6px 0 2px" }}>
        {rt ? `${rt.km < 10 ? rt.km.toFixed(1) : Math.round(rt.km)} km ${t("pl_from_you")} \u00B7 ${rt.min} ${t("nav_min")}` : me ? t("rdv_road_wait") : t("pl_finding_you")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <Btn kind="ghost" onClick={() => setFull(true)}>{t("rdv_dir")}</Btn>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.lng}&travelmode=driving`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 16px", borderRadius: 22, background: "#0B3A78", color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>{t("pl_gmaps")}</a>
      </div>
    </div>
  );
}

export function PlanLive({ api, id, accepted, asWorker, fromText = "", toText = "" }) {
  const { t } = useI18n();
  const [pts, setPts] = useState([]);
  const [geo, setGeo] = useState({}); // addresses looked up when the booking carries no points
  const [nav, setNav] = useState(null);
  const [on, setOn] = useState(false);
  const [mine, setMine] = useState(null);
  const [note, setNote] = useState("");
  const sent = useRef(0);

  useEffect(() => {
    let alive = true;
    const pull = async () => { try { const r = many(await api.planLiveGet(id)); if (alive) setPts(r); } catch (_) { /* next tick */ } };
    pull();
    const timer = setInterval(() => { if (!document.hidden) pull(); }, 6000);
    return () => { alive = false; clearInterval(timer); };
  }, [api, id]);

  useEffect(() => {
    if (!on || !accepted) return undefined;
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (!geo) return undefined;
    const w = geo.watchPosition((g) => {
      const cur = { lat: g.coords.latitude, lng: g.coords.longitude };
      setMine(cur);
      if (Date.now() - sent.current > 8000) {
        sent.current = Date.now();
        Promise.resolve(api.planLiveSet(id, cur.lat, cur.lng)).then((ok) => setNote(ok === false ? t("pl_not_yet") : "")).catch(() => {});
      }
    }, () => setNote(t("pl_no_gps")), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => geo.clearWatch(w);
  }, [on, accepted, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const get = (k) => pts.find((p) => p.kind === k);
  const sa = get("pick"), sb = get("drop"), other = get("other");
  // Older requests have no saved points: find the two addresses on the map instead.
  useEffect(() => {
    if ((sa && sb) || (!fromText && !toText)) return undefined;
    let alive = true;
    const look = async (txt) => { try { const r = await searchAnywhere(txt, {}); const hit = (r.rows || []).find((x) => typeof x.lat === "number"); return hit ? { lat: hit.lat, lng: hit.lng } : null; } catch (_) { return null; } };
    (async () => { const [x, y] = await Promise.all([look(fromText), look(toText)]); if (alive) setGeo({ a: x, b: y }); })();
    return () => { alive = false; };
  }, [!!sa, !!sb, fromText, toText]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = sa || (geo.a ? { lat: geo.a.lat, lng: geo.a.lng } : null), b = sb || (geo.b ? { lat: geo.b.lat, lng: geo.b.lng } : null);
  const meP = mine || get("me");
  const pick = a ? { lat: a.lat, lng: a.lng } : null, drop = b ? { lat: b.lat, lng: b.lng } : null;
  const rider = asWorker ? meP : other;
  const toPick = useRoadRoute(rider && pick ? { lat: rider.lat, lng: rider.lng } : null, pick);
  const trip = useRoadRoute(pick, drop);
  if (!pick || !drop) return null;
  const markers = [{ id: "a", kind: "pickup", lat: pick.lat, lng: pick.lng }, { id: "b", kind: "drop", lat: drop.lat, lng: drop.lng }];
  if (meP) markers.push({ id: "me", kind: "me", lat: meP.lat, lng: meP.lng });
  if (other) markers.push({ id: "other", kind: "driver", online: true, emoji: asWorker ? "\u{1F642}" : "\u{1F3CD}️", lat: other.lat, lng: other.lng, label: asWorker ? t("pl_customer") : t("pl_rider") });
  const lines = [];
  if (toPick) lines.push({ pts: toPick.pts, dashed: true });
  if (trip) lines.push({ pts: trip.pts });
  const away = rider && pick ? kmBetween(rider, pick) : null;
  const navRow = (n, title, text, to, from) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", background: n === 1 ? "#16A34A" : "#DC2626", color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: T.ink }}>{title}</span>
        <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, overflowWrap: "anywhere" }}>{text}</span>
      </span>
      <Btn onClick={() => setNav({ from, to, title })}>{t("rdv_dir")}</Btn>
      <a href={`https://www.google.com/maps/dir/?api=1${from ? `&origin=${from.lat},${from.lng}` : ""}&destination=${to.lat},${to.lng}&travelmode=driving`} target="_blank" rel="noopener noreferrer" aria-label="Google Maps" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44, borderRadius: 22, background: "#0B3A78", color: "#fff", fontWeight: 800, fontSize: 12, textDecoration: "none", padding: "0 10px" }}>Maps</a>
    </div>
  );
  return (
    <div style={{ padding: "4px 14px 8px" }}>
      {nav && <RouteNav from={nav.from} to={nav.to} title={nav.title} onClose={() => setNav(null)} />}
      <UberMap markers={markers} lines={lines} height="34vh" fitKey={`${!!meP}${!!other}${!!trip}`} />
      {away != null && <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, margin: "6px 0 2px" }}>{String(t("pl_rider_away")).replace("{n}", fmt(away))}</div>}
      {asWorker && (
        <div style={{ margin: "6px 0 4px" }}>
          {navRow(1, t("pl_go_pickup"), fromText, pick, meP ? { lat: meP.lat, lng: meP.lng } : null)}
          {navRow(2, t("pl_go_dest"), toText, drop, pick)}
        </div>
      )}
      {accepted && (
        <div style={{ margin: "6px 0 2px" }}>
          <Btn full kind={on ? "ghost" : "primary"} onClick={() => setOn((v) => !v)}>{on ? t("pl_stop") : t("pl_share")}</Btn>
          {on && !other && <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>{t("pl_waiting_other")}</div>}
          {note && <div style={{ fontSize: 13, color: "#B45309", fontWeight: 700, marginTop: 6 }}>{note}</div>}
        </div>
      )}
    </div>
  );
}
