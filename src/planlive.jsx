// MAP FOR A SCHEDULED RIDE, for the customer and the rider alike: the pickup, the destination, the road
// between them, and (while the trip is near) each other's live position. Each side shares its own phone
// location while the map is open and sharing is on; the other side sees it move.
import React, { useEffect, useRef, useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { UberMap, useRoadRoute, kmBetween } from "./nearmap.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const fmt = (km) => (km < 1 ? `${Math.max(50, Math.round(km * 10) * 100)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

// The road for a pickup and a destination, used both here and in the booking sheet.
export function RoutePreviewMap({ pick, drop, height = "34vh" }) {
  const rt = useRoadRoute(pick, drop);
  if (!pick || !drop) return null;
  const markers = [{ id: "a", kind: "pickup", lat: pick.lat, lng: pick.lng }, { id: "b", kind: "drop", lat: drop.lat, lng: drop.lng }];
  return <UberMap markers={markers} lines={rt ? [{ pts: rt.pts }] : []} height={height} fitKey={rt ? "r" : "l"} />;
}

export function PlanLive({ api, id, accepted, asWorker }) {
  const { t } = useI18n();
  const [pts, setPts] = useState([]);
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
  const a = get("pick"), b = get("drop"), other = get("other");
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
  return (
    <div style={{ padding: "4px 14px 8px" }}>
      <UberMap markers={markers} lines={lines} height="34vh" fitKey={`${!!meP}${!!other}${!!trip}`} />
      {away != null && <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, margin: "6px 0 2px" }}>{String(t("pl_rider_away")).replace("{n}", fmt(away))}</div>}
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
