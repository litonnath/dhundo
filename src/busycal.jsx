// When is this worker taken? A 14-day strip: busy days are shaded, and the
// busy hours are listed. Only time slots, never who booked.
import React, { useEffect, useState } from "react";
import { T } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const hm = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function useBusy(api, workerId, exclude = null) {
  const [slots, setSlots] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.workerBusy ? api.workerBusy(workerId, exclude) : []).then((r) => {
      if (alive) setSlots((Array.isArray(r) ? r : []).map((x) => ({ a: new Date(x.start_at), b: new Date(x.end_at) })));
    }).catch(() => { if (alive) setSlots([]); });
    return () => { alive = false; };
  }, [api, workerId, exclude]);
  return slots;
}

// Does the window [a, b) touch a busy slot?
export const clashWith = (slots, a, b) => !!slots && slots.some((s) => s.a < b && s.b > a);

export function BusyCalendar({ slots, picked = null }) {
  const { t } = useI18n();
  if (slots === null) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; });
  const byDay = {};
  slots.forEach((s) => {
    const c = new Date(s.a); c.setHours(0, 0, 0, 0);
    while (c < s.b) {
      const next = new Date(c); next.setDate(next.getDate() + 1);
      const from = s.a > c ? s.a : c, to = s.b < next ? s.b : next;
      (byDay[dayKey(c)] = byDay[dayKey(c)] || []).push([from, to]);
      c.setDate(c.getDate() + 1);
    }
  });
  const pk = picked ? dayKey(picked) : null;
  const busyDays = days.filter((d) => byDay[dayKey(d)]);
  return (
    <div style={{ margin: "4px 0 12px", padding: "12px", borderRadius: 14, background: "#F6F9FE", border: "1px solid #D6E3F5" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0B3A78", marginBottom: 8 }}>{t("bc_title")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
        {days.map((d) => {
          const busy = !!byDay[dayKey(d)];
          const sel = pk === dayKey(d);
          return (
            <div key={dayKey(d)} style={{ textAlign: "center", padding: "6px 0", borderRadius: 10, background: busy ? "#FDECEC" : "#E7F5EC", border: sel ? "2px solid #0A5BB8" : "2px solid transparent" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft }}>{d.toLocaleDateString([], { weekday: "short" }).slice(0, 3)}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: busy ? "#B91C1C" : "#15803D" }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 12, fontWeight: 700, color: T.inkSoft, margin: "8px 0 2px" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#E7F5EC", border: "1px solid #15803D", marginRight: 5 }} />{t("bc_free")}</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#FDECEC", border: "1px solid #B91C1C", marginRight: 5 }} />{t("bc_busy")}</span>
      </div>
      {busyDays.length === 0
        ? <div style={{ fontSize: 13.5, fontWeight: 700, color: "#15803D", marginTop: 6 }}>{t("bc_all_free")}</div>
        : busyDays.map((d) => (
          <div key={dayKey(d)} style={{ fontSize: 13.5, color: T.ink, marginTop: 6, lineHeight: 1.45 }}>
            <b>{d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}:</b>{" "}
            {byDay[dayKey(d)].map(([a, b]) => `${hm(a)} – ${hm(b)}`).join(", ")}
          </div>
        ))}
    </div>
  );
}
