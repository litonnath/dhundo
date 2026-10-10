// On a worker's search card: the rating and reviews, the worker's hourly,
// daily and monthly rates, and your own booking history with them.
import React, { useEffect, useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { RateBox } from "./bizpay.jsx";

const money = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const day = (iso) => { try { return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" }); } catch (_) { return ""; } };
const stamp = (iso) => { try { return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (_) { return ""; } };
const star = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

export function WorkerExtras({ api, row, onOpenBookings }) {
  const { t } = useI18n();
  const [d, setD] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [rating, setRating] = useState(false);
  const load = () => {
    let alive = true;
    Promise.resolve(api.workerCardExtra ? api.workerCardExtra(row.id) : null).then((r) => { if (alive) setD(Array.isArray(r) ? r[0] : r); }).catch(() => {});
    return () => { alive = false; };
  };
  useEffect(load, [api, row.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d || row.is_example) return null;
  const rates = (d.rates || []).slice().sort((a, b) => ["hour", "day", "month"].indexOf(a.unit) - ["hour", "day", "month"].indexOf(b.unit));
  const label = { hour: t("rq_hourly"), day: t("rq_daily"), month: t("rq_monthly") };
  const openReviews = async (isOpen) => {
    if (!isOpen || reviews !== null) return;
    try { const r = await api.reviewsFor(row.id, 5); setReviews(Array.isArray(r) ? r : []); } catch (_) { setReviews([]); }
  };
  return (
    <div style={{ padding: "0 14px 12px" }}>
      {rates.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "2px 0 8px" }}>
          {rates.map((r) => (
            <span key={r.unit} style={{ fontSize: 13, fontWeight: 800, color: "#0B3A78", background: "#E8F0FB", border: "1px solid #CFE0F7", borderRadius: 14, padding: "4px 11px" }}>
              {label[r.unit]} {money(r.rupees)}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {Number(d.n) > 0
          ? <span style={{ fontSize: 14, fontWeight: 800, color: "#B7791F" }}>{"★"} {Number(d.avg).toFixed(1)} <span style={{ color: T.inkSoft, fontWeight: 600 }}>({d.n})</span></span>
          : <span style={{ fontSize: 13, color: T.inkSoft }}>{t("we_no_rating")}</span>}
      </div>
      {Number(d.n) > 0 && (
        <details onToggle={(e) => openReviews(e.currentTarget.open)} style={{ margin: "2px 0 0" }}>
          <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: T.brandDark, minHeight: 36, display: "flex", alignItems: "center" }}>{t("orr_reviews")}</summary>
          {reviews === null && <div style={{ fontSize: 13, color: T.inkSoft }}>{"…"}</div>}
          {reviews && reviews.length === 0 && <div style={{ fontSize: 13, color: T.inkSoft }}>{t("orr_no_reviews")}</div>}
          {(reviews || []).map((r, i) => (
            <div key={i} style={{ padding: "7px 0", borderTop: "1px solid #EEF0F3" }}>
              <span style={{ color: "#B7791F", letterSpacing: 1 }}>{star(r.stars)}</span>
              <div style={{ fontSize: 14, color: T.ink, overflowWrap: "anywhere" }}>{r.comment}</div>
            </div>
          ))}
        </details>
      )}
      {d.active_status && (
        <div style={{ margin: "8px 0 0", padding: "10px 12px", borderRadius: 12, background: "#E7F5EC", border: "1px solid #BEE3CB", color: "#166534", fontSize: 14, fontWeight: 800, lineHeight: 1.45 }}>
          {t("we_already")} {"·"} {t(d.active_status === "accepted" ? "mbk_accepted" : "mbk_waiting")}
          {d.active_at && <div style={{ fontWeight: 600 }}>{stamp(d.active_at)}</div>}
          {onOpenBookings && <button onClick={onOpenBookings} style={{ marginTop: 6, minHeight: 40, padding: "0 16px", borderRadius: 20, border: "none", background: "#15803D", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{t("we_view")}</button>}
        </div>
      )}
      {!d.active_status && Number(d.total) > 0 && (
        <div style={{ margin: "8px 0 0", fontSize: 13.5, fontWeight: 700, color: T.inkSoft }}>
          {String(t("we_history")).replace("{n}", d.total).replace("{when}", d.last_at ? day(d.last_at) : "")}
        </div>
      )}
      {d.to_review && !rating && (
        <div style={{ marginTop: 8 }}><Btn kind="ghost" onClick={() => setRating(true)}>{t("we_rate")}</Btn></div>
      )}
      {d.to_review && rating && (
        <RateBox api={api} orderId={d.to_review} title={t("we_rate_title")}
                 submit={(o) => api.reviewAdd({ worker: row.id, kind: "hire", ref: d.to_review, stars: o.stars, comment: o.comment, complaint: o.complaint })}
                 onDone={() => { setRating(false); load(); }} />
      )}
    </div>
  );
}
