// ===========================================================================
// profile.jsx -- "My listing", rebuilt for somebody who does not fill in
// forms for a living.
//
// WHAT WAS WRONG WITH THE FIRST VERSION
// It was one long form -- face, work, contact, address, ID -- with a single
// "Save changes" button at the bottom. Three problems, all of them worse for
// the person this is for than for the person who wrote it:
//
//   * Nothing was saved until you reached the end. Somebody who filled in
//     their rate, got a phone call, and came back later had lost it, and
//     there was no way to tell that from looking at the screen.
//   * The button sat below five sections. On a phone that is a lot of
//     scrolling past questions you have already answered to reach it.
//   * It asked everything at once, so it looked like a government form. A
//     person who is unsure closes a screen like that.
//
// WHAT IT IS NOW
//
//   * EVERY SECTION SAVES ITSELF. Each has its own button, writes only its
//     own fields, and says "Saved" where you are already looking.
//     services_update_my_listing ignores nulls, so partial saves were always
//     possible -- the old screen simply did not use that.
//   * PHOTOS SAVE THE MOMENT THEY UPLOAD. Somebody who has just photographed
//     their own finished wall has decided; a Save button afterwards is a
//     step that exists only because the form was built that way.
//   * A SHORT LIST OF WHAT IS MISSING sits at the top, in plain words, and
//     names only what is actually absent. It disappears once the listing is
//     filled in -- a permanent checklist is a permanent reproach.
//   * Nothing is required. Every one of these can be skipped and the listing
//     still works.
// ===========================================================================
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  T, Icon, Btn, Chip, Notice, input, ConfirmDelete,
  groupStyle, groupLabel,
  plateLooksRight,
} from "./ui.jsx";
import { useI18n, tradeName, DEFAULT_STATE } from "./i18n.jsx";
import { PlaceField } from "./locpicker.jsx";
import { useConsent } from "./consent-core.js";

const PHOTO_BUCKET = "services-photos";
const ID_BUCKET = "services-ids";
const MAX_PHOTOS = 6;

// Set to false to remove ID uploads entirely. The database side can stay
// exactly as it is -- nothing breaks, the section simply does not render.
export const ID_UPLOADS_ENABLED = true;

const field = {
  ...input, minHeight: 52, fontSize: 16, padding: "13px 14px", borderRadius: 11,
};

function Row({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 7,
      }}>{label}</label>
      {children}
      {hint && (
        <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
      )}
    </div>
  );
}

// A section that saves on its own. `dirty` decides whether the button is
// offered at all, so an untouched section shows nothing to press and the
// screen stays quiet until there is something to do.
function Section({ title, children, onSave, saving, saved, dirty, note }) {
  const { t } = useI18n();
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.line}`, borderRadius: 16,
      padding: "18px 16px", marginBottom: 14,
    }}>
      <h3 style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, margin: "0 0 14px" }}>
        {title}
      </h3>
      {children}
      {note}
      {onSave && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          {dirty ? (
            <button onClick={onSave} disabled={saving} style={{
              padding: "11px 20px", borderRadius: 10, minHeight: 46, border: "none",
              background: T.brandDark, color: "#fff", fontSize: 14.5, fontWeight: 700,
              fontFamily: "inherit", cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}>{saving ? t("saving") : t("p_save_this")}</button>
          ) : saved ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5,
              fontWeight: 700, color: T.green,
            }}><Icon name="check" size={17} /> {t("p_saved")}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function MyListing({ api, trades, isAdmin, onGoAdd }) {
  const consent = useConsent();
  const { t, lang } = useI18n();

  const [row, setRow] = useState(undefined);   // undefined = loading, null = none
  const [f, setF] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pickGroup, setPickGroup] = useState(null);
  // Which group the "also does" chips are drawn from. Default null means the
  // main trade's own group -- the near-certain answer, so it needs no tap.
  // A driver who also does deliveries, a carpenter who also sells timber:
  // those live in another group, and before this there was no way to reach
  // them from here at all.
  const [moreGroup, setMoreGroup] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);
  const [dirty, setDirty] = useState({});
  const photoInput = useRef(null);
  const faceInput = useRef(null);
  const idInput = useRef(null);

  const load = useCallback(() => {
    api.myListing()
      .then((r) => {
        const one = Array.isArray(r) ? r[0] || null : r || null;
        setRow(one);
        if (one) {
          setF({
            full_name: one.full_name || "",
            business_name: one.business_name || "",
            phone: String(one.phone || "").replace(/\D/g, "").slice(-10),
            trade_slug: one.trade_slug,
            other_trades: one.other_trades || [],
            years_experience: one.years_experience ?? "",
            day_rate_min: one.day_rate_min ?? "",
            day_rate_max: one.day_rate_max ?? "",
            locality: one.locality || "",
            state: one.state || DEFAULT_STATE,
            about: one.about || "",
            photos: one.photos || [],
            avatar_url: one.avatar_url || "",
            address_line: one.address_line || "",
            landmark: one.landmark || "",
            pincode: one.pincode || "",
            address_public: !!one.address_public,
            vehicle_number: one.vehicle_number || "",
            city_id: one.city_id || null,
            city_name: one.city || "",
            district: one.district || "",
            available: one.available,
          });
          setDirty({});
        }
      })
      .catch(() => setRow(null));
  }, [api]);

  useEffect(load, [load]);

  const groups = useMemo(() => {
    const out = [];
    trades.forEach((x) => { if (!out.includes(x.group_name)) out.push(x.group_name); });
    return out;
  }, [trades]);

  if (row === undefined) {
    return <div style={{ padding: "28px 4px", color: T.inkFaint }}>{t("m_loading")}</div>;
  }

  if (row === null) {
    return (
      <div style={{
        maxWidth: 520, background: T.white, border: `1px solid ${T.line}`,
        borderRadius: 16, padding: "28px 20px", textAlign: "center",
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
          {t("p_none_title")}
        </div>
        <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, margin: "0 0 18px" }}>
          {t("p_none_body")}
        </p>
        <Btn full onClick={onGoAdd}>{t("nav_list")}</Btn>
      </div>
    );
  }

  const set = (key, k, v) => {
    setF((p) => ({ ...p, [k]: v }));
    setDirty((d) => ({ ...d, [key]: true }));
    setSavedKey(null);
  };
  const num = (v) => (String(v).trim() === "" ? null : Number(v));
  // -------------------------------------------------------------- saving
  // One place, so every section behaves identically and a new section
  // cannot invent its own error handling.
  const save = async (key, payload, opts = {}) => {
    setErr(null); setMsg(null);
    // Changing a listing stores it and shows it: needs the listing consent
    // (an admin editing somebody else's is not the owner and is not asked).
    if (!isAdmin && !(await consent.ask("listing"))) return;
    setSavingKey(key);
    try {
      const r = await api.updateMyListing(payload);
      const one = Array.isArray(r) ? r[0] : r;
      if (one && one.ok) {
        setDirty((d) => ({ ...d, [key]: false }));
        setSavedKey(key);
        if (one.reason === "saved_reverify") setMsg(t("p_saved_reverify"));
        if (opts.reload !== false) load();
        // The tick fades, so the page does not accumulate green ticks from
        // edits made an hour ago.
        setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 4000);
      } else {
        const why = one && one.reason;
        setErr(
          why === "bad_vehicle" ? t("e_vehicle")
          : why === "phone_taken" ? t("e_taken")
          : why === "bad_phone" ? t("e_badphone")
          : why === "bad_trade" ? t("e_badtrade")
          : why === "bad_state" ? t("e_badstate")
          : why === "bad_pincode" ? t("e_badpin")
          : why === "too_many_trades" ? t("p_max_trades")
          : t("e_save")
        );
      }
    } catch (e) {
      setErr(e.message || t("e_save"));
    } finally {
      setSavingKey(null);
    }
  };

  const phoneChanged =
    String(f.phone).replace(/\D/g, "").slice(-10) !==
    String(row.phone || "").replace(/\D/g, "").slice(-10);

  const toggleTrade = (slug) => {
    if (slug === f.trade_slug) return;
    const has = f.other_trades.includes(slug);
    if (!has && f.other_trades.length >= 5) { setErr(t("p_max_trades")); return; }
    setErr(null);
    set("work", "other_trades",
        has ? f.other_trades.filter((s) => s !== slug) : [...f.other_trades, slug]);
  };

  // ------------------------------------------------------------- uploads
  const uploadPhoto = async (file) => {
    if (!file) return;
    if (f.photos.length >= MAX_PHOTOS) { setErr(t("p_max_photos")); return; }
    setUploading(true); setErr(null); setMsg(null);
    try {
      const url = await api.uploadPublic(PHOTO_BUCKET, file);
      const next = [...f.photos, url];
      setF((p) => ({ ...p, photos: next }));
      await save("photos", { p_photos: next });
    } catch (e) {
      setErr(e.message === "too_large" ? t("p_too_large") : (e.message || t("p_upload_failed")));
    } finally {
      setUploading(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  };

  const removePhoto = async (i) => {
    const next = f.photos.filter((_, j) => j !== i);
    setF((p) => ({ ...p, photos: next }));
    await save("photos", { p_photos: next });
  };

  const uploadFace = async (file) => {
    if (!file) return;
    setUploading(true); setErr(null); setMsg(null);
    try {
      const url = await api.uploadPublic(PHOTO_BUCKET, file);
      setF((p) => ({ ...p, avatar_url: url }));
      await save("face", { p_avatar_url: url });
    } catch (e) {
      setErr(e.message === "too_large" ? t("p_too_large") : (e.message || t("p_upload_failed")));
    } finally {
      setUploading(false);
      if (faceInput.current) faceInput.current.value = "";
    }
  };

  const uploadId = async (file) => {
    if (!file) return;
    setUploading(true); setErr(null); setMsg(null);
    try {
      const path = await api.uploadPrivate(ID_BUCKET, file);
      await save("id", { p_id_doc_path: path });
      setMsg(t("p_id_added"));
    } catch (e) {
      setErr(e.message === "too_large" ? t("p_too_large") : (e.message || t("p_upload_failed")));
    } finally {
      setUploading(false);
      if (idInput.current) idInput.current.value = "";
    }
  };

  const removeId = async () => {
    try {
      const r = await api.discardIdDoc();
      const one = Array.isArray(r) ? r[0] : r;
      if (one && one.ok) { setMsg(t("p_id_removed")); load(); }
    } catch (e) { setErr(e.message || t("e_save")); }
  };

  // ------------------------------------------------------------ to-do list
  // Only what is missing, in the order it is worth doing, each saying what
  // the person GETS rather than what the app wants.
  //
  // The first two come from the DATABASE's own list of what is missing
  // (services_listing_gaps, in 67), not from a second opinion written here.
  // If the app and the approval gate disagreed about "ready", somebody would
  // tick everything off and then be refused with no idea why.
  const todo = [];
  const gaps = (row && row.gaps) || [];
  // What the approval gate will refuse for is shown first, in red, apart from
  // the nice-to-haves, so nobody has to hunt for the reason they are not live.
  const blockers = [];
  if (gaps.includes("vehicle_number")) blockers.push({ key: "work", label: t("todo_vehicle") });
  if (gaps.includes("id_doc")) blockers.push({ key: "id", label: t("todo_id") });
  // A position that is only the middle of a PIN code, village or city makes
  // every distance to this listing approximate; an exact pin fixes that.
  if (row.loc_source !== undefined && !["device", "picked"].includes(row.loc_source || "")) {
    todo.push({ key: "contact", label: t("todo_pin") });
  }
  if (!f.avatar_url) todo.push({ key: "face", label: t("todo_face") });
  if (!f.photos.length) todo.push({ key: "photos", label: t("todo_photos") });
  if (!f.day_rate_min && !f.day_rate_max) todo.push({ key: "work", label: t("todo_rate") });
  if (!f.locality) todo.push({ key: "contact", label: t("todo_area") });

  const jump = (key) => {
    const el = document.getElementById("sec-" + key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const statusTone =
    row.status === "approved" ? { bg: T.greenSoft, fg: T.green }
    : row.status === "hidden" ? { bg: "#F1F3F5", fg: T.inkSoft }
    : { bg: T.accentSoft, fg: "#8A4A00" };

  return (
    <div style={{ maxWidth: 620, paddingBottom: 40 }}>
      {/* ------------------------------------------------------- status */}
      <div style={{
        background: T.white, border: `1px solid ${T.line}`, borderRadius: 16,
        padding: "16px", marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{
            padding: "5px 11px", borderRadius: 20, fontSize: 12.5, fontWeight: 800,
            background: statusTone.bg, color: statusTone.fg,
          }}>
            {row.status === "approved" ? t("m_approved")
              : row.status === "hidden" ? t("m_hidden") : t("m_pending")}
          </span>
          {row.verified && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5,
              fontWeight: 700, color: T.green,
            }}><Icon name="check" size={15} />{t("checked")}</span>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12.5, color: T.inkFaint }}>
            {row.contact_views} {t("m_views")}
          </span>
        </div>

        {/* WHY THEY WERE HIDDEN, in their own language, at the top of their
            own page. Before this, being hidden was silent: the status chip
            changed and the person was left to work out from the phone not
            ringing that something had happened. Somebody whose week depends
            on this cannot fix a problem nobody told them about. */}
        {row.status === "hidden" && row.rejection_reason && (
          <div style={{
            marginTop: 14, padding: "13px 14px", borderRadius: 12,
            background: T.redSoft, border: `1px solid rgba(196,61,46,0.3)`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.red, marginBottom: 5 }}>
              {t("m_hidden_why")}
            </div>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.6 }}>
              {row.rejection_reason}
            </div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.55, marginTop: 8 }}>
              {t("m_hidden_fix")}
            </div>
          </div>
        )}

        {/* Hidden with nothing written: still better than silence. */}
        {row.status === "hidden" && !row.rejection_reason && (
          <div style={{ marginTop: 14 }}>
            <Notice tone="bad">{t("m_hidden_noreason")}</Notice>
          </div>
        )}

        {/* Saves on the tap. Somebody switching this off wants the phone to
            stop ringing now, not after they find a button. */}
        <label style={{
          display: "flex", alignItems: "center", gap: 10, marginTop: 14,
          padding: "12px 13px", borderRadius: 11, cursor: "pointer",
          border: `1px solid ${f.available ? T.line : "rgba(248,118,23,0.4)"}`,
          background: f.available ? T.white : T.accentSoft, minHeight: 52,
        }}>
          <input type="checkbox" checked={!f.available}
                 onChange={(e) => {
                   const next = !e.target.checked;
                   setF((p) => ({ ...p, available: next }));
                   save("avail", { p_available: next });
                 }} />
          <span style={{ fontSize: 14.5, color: T.ink, fontWeight: 600 }}>
            {t("p_pause")}
          </span>
        </label>
      </div>

      {msg && <Notice tone="good">{msg}</Notice>}
      {err && <Notice tone="bad">{err}</Notice>}

      {/* ------------------------------------------------------- missing */}
      {blockers.length > 0 && (
        <div style={{
          background: T.redSoft, border: `1.5px solid ${T.red}`, borderRadius: 16,
          padding: "14px 16px", marginBottom: 14,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.red, marginBottom: 8 }}>
            {t("req_title")}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {blockers.map((item) => (
              <button key={item.key + item.label} onClick={() => jump(item.key)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "13px 14px", borderRadius: 11, minHeight: 52, cursor: "pointer",
                border: `1px solid ${T.red}`, background: T.white, color: T.ink, textAlign: "left",
                fontSize: 14.5, fontWeight: 700, fontFamily: "inherit",
              }}>
                <span style={{ color: T.red, display: "inline-flex" }}><Icon name="alert" size={18} /></span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: T.red, whiteSpace: "nowrap",
                  background: T.redSoft, padding: "3px 8px", borderRadius: 10,
                }}>{t("req_missing")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- to-do */}
      {todo.length > 0 && (
        <div style={{
          background: T.brandSoft, border: `1px solid rgba(5,66,145,0.2)`,
          borderRadius: 16, padding: "16px", marginBottom: 14,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.brandDeep, marginBottom: 4 }}>
            {t("todo_title")}
          </div>
          <div style={{ fontSize: 13, color: T.brandDeep, opacity: 0.85,
                        lineHeight: 1.55, marginBottom: 12 }}>
            {t("todo_sub")}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {todo.map((item) => (
              <button key={item.key} onClick={() => jump(item.key)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "13px 14px", borderRadius: 11, minHeight: 52, cursor: "pointer",
                border: "none", background: T.white, color: T.ink, textAlign: "left",
                fontSize: 14.5, fontWeight: 600, fontFamily: "inherit",
              }}>
                <span style={{ color: item.blocking ? T.red : T.brandDark, flexShrink: 0,
                               display: "inline-flex",
                               transform: item.blocking ? "none" : "rotate(-90deg)" }}>
                  <Icon name={item.blocking ? "alert" : "chev"} size={18} />
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {/* A photo makes you easier to hire; a missing plate or ID
                    means you are not on the site at all. Those are not the
                    same kind of unfinished, so they do not look the same. */}
                {item.blocking && (
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: T.red, whiteSpace: "nowrap",
                    background: T.redSoft, padding: "3px 8px", borderRadius: 10,
                  }}>{t("todo_required")}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- face */}
      <div id="sec-face">
        <Section title={t("p_face")}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{
              width: 84, height: 84, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: f.avatar_url ? `center/cover url(${f.avatar_url})` : T.brandSoft,
              border: `2px solid ${T.brandSoft}`, display: "flex",
              alignItems: "center", justifyContent: "center", color: T.brandDark,
            }}>
              {!f.avatar_url && <Icon name="user" size={38} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 10px" }}>
                {t("p_face_hint")}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => faceInput.current && faceInput.current.click()}
                        disabled={uploading}
                        style={{
                          padding: "11px 15px", borderRadius: 10, minHeight: 46,
                          border: "none", background: T.brandDark, color: "#fff",
                          fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                          cursor: uploading ? "default" : "pointer",
                        }}>
                  {uploading ? t("p_uploading")
                    : f.avatar_url ? t("p_face_change") : t("p_face_add")}
                </button>
                {f.avatar_url && (
                  <button onClick={() => {
                            setF((p) => ({ ...p, avatar_url: "" }));
                            save("face", { p_avatar_url: "-" });
                          }} style={{
                    padding: "11px 15px", borderRadius: 10, minHeight: 46,
                    border: `1px solid ${T.line}`, background: T.white, color: T.red,
                    fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                  }}>{t("p_remove")}</button>
                )}
              </div>
            </div>
          </div>
          <input ref={faceInput} type="file" accept="image/*" capture="user"
                 style={{ display: "none" }}
                 onChange={(e) => uploadFace(e.target.files && e.target.files[0])} />
        </Section>
      </div>

      {/* -------------------------------------------------------- photos */}
      <div id="sec-photos">
        <Section title={t("p_photos")}>
          <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>
            {t("p_photos_hint")}
          </p>
          <div style={{
            display: "grid", gap: 8,
            gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
          }}>
            {f.photos.map((src, i) => (
              <div key={src + i} style={{
                position: "relative", paddingTop: "100%", borderRadius: 11,
                overflow: "hidden", background: T.paper, border: `1px solid ${T.line}`,
              }}>
                <img src={src} alt="" style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "cover",
                }} />
                <button onClick={() => removePhoto(i)} aria-label={t("p_remove")}
                  style={{
                    position: "absolute", top: 5, right: 5, width: 30, height: 30,
                    borderRadius: "50%", border: "none", cursor: "pointer",
                    background: "rgba(15,20,25,0.62)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Icon name="close" size={16} /></button>
              </div>
            ))}
            {f.photos.length < MAX_PHOTOS && (
              <button onClick={() => photoInput.current && photoInput.current.click()}
                disabled={uploading}
                style={{
                  position: "relative", paddingTop: "100%", borderRadius: 11,
                  border: `1.5px dashed ${T.line}`, background: T.paper,
                  cursor: uploading ? "default" : "pointer", fontFamily: "inherit",
                }}>
                <span style={{
                  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4, color: T.brandDark,
                }}>
                  <Icon name="download" size={20} style={{ transform: "rotate(180deg)" }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>
                    {uploading ? t("p_uploading") : t("p_add_photo")}
                  </span>
                </span>
              </button>
            )}
          </div>
          <input ref={photoInput} type="file" accept="image/*" capture="environment"
                 style={{ display: "none" }}
                 onChange={(e) => uploadPhoto(e.target.files && e.target.files[0])} />
        </Section>
      </div>

      {/* ---------------------------------------------------------- work */}
      <div id="sec-work">
        <Section
          title={t("p_work")}
          dirty={dirty.work} saving={savingKey === "work"} saved={savedKey === "work"}
          onSave={() => save("work", {
            p_trade_slug: f.trade_slug,
            p_other_trades: f.other_trades,
            p_vehicle_number: f.vehicle_number.trim() || null,
            p_day_rate_min: num(f.day_rate_min),
            p_day_rate_max: num(f.day_rate_max),
            p_years_experience: num(f.years_experience),
            p_about: f.about.trim() || "-",
          })}
        >
          <Row label={t("p_main_trade")}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 13px",
              border: `1px solid ${T.line}`, borderRadius: 11, minHeight: 52,
            }}>
              <span style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, flex: 1 }}>
                {tradeName(trades.find((x) => x.slug === f.trade_slug), lang) || row.trade_name}
              </span>
              <button onClick={() => setPickGroup(pickGroup ? null : "__open")} style={{
                background: "none", border: "none", cursor: "pointer", color: T.brandDark,
                fontWeight: 700, fontSize: 13.5, minHeight: 40, fontFamily: "inherit",
              }}>{t("w1_change")}</button>
            </div>
          </Row>

          {pickGroup && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
                {groups.map((g) => (
                  <Chip key={g} active={pickGroup === g} onClick={() => setPickGroup(g)}>
                    {groupLabel(g, lang)}
                  </Chip>
                ))}
              </div>
              {pickGroup !== "__open" && (
                <div style={{ display: "grid", gap: 7 }}>
                  {trades.filter((x) => x.group_name === pickGroup).map((tr) => (
                    <button key={tr.slug}
                      onClick={() => { set("work", "trade_slug", tr.slug); setPickGroup(null); }}
                      style={{
                        padding: "12px 13px", borderRadius: 10, minHeight: 48, cursor: "pointer",
                        border: `1px solid ${f.trade_slug === tr.slug ? T.brandDark : T.line}`,
                        background: f.trade_slug === tr.slug ? T.brandSoft : T.white,
                        color: T.ink, textAlign: "left", fontSize: 15, fontFamily: "inherit",
                      }}>{tradeName(tr, lang)}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Row label={t("p_other_trades")} hint={t("p_other_trades_hint")}>
            {f.other_trades.length > 0 && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
                {f.other_trades.map((slug) => (
                  <Chip key={slug} active onClick={() => toggleTrade(slug)}>
                    {tradeName(trades.find((x) => x.slug === slug), lang) || slug}
                    <span style={{ opacity: 0.7, marginLeft: 5 }}>×</span>
                  </Chip>
                ))}
              </div>
            )}
            {/* Group picker. Shown as a row of quiet chips with the current
                one marked, rather than a select element: this screen is used
                one-handed on a phone and a native dropdown on Android hides
                half of it behind the keyboard. */}
            <div style={{ fontSize: 12, fontWeight: 800, color: T.inkFaint,
                          textTransform: "uppercase", letterSpacing: 0.4, margin: "2px 0 7px" }}>
              {t("p_more_group")}
            </div>
            <div style={{
              display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12,
              paddingBottom: 12, borderBottom: `1px solid ${T.line}`,
            }}>
              {groups.map((g) => {
                const cur = (moreGroup ||
                  (trades.find((y) => y.slug === f.trade_slug) || {}).group_name);
                return (
                  <Chip key={g} active={cur === g} onClick={() => setMoreGroup(g)}>
                    {groupLabel(g, lang)}
                  </Chip>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {trades
                .filter((x) => x.slug !== f.trade_slug && !f.other_trades.includes(x.slug))
                .filter((x) => x.group_name === (moreGroup ||
                  (trades.find((y) => y.slug === f.trade_slug) || {}).group_name))
                .map((tr) => (
                  <Chip key={tr.slug} onClick={() => toggleTrade(tr.slug)}>
                    + {tradeName(tr, lang)}
                  </Chip>
                ))}
            </div>
          </Row>

          {/* Only for a trade that drives, and driven by the database's own
              flag rather than a group name written here -- the same source
              the approval gate reads, so the two cannot disagree. */}
          {row && row.requires_vehicle && (
            <Row label={t("w3_vehicle")} hint={t("w3_vehicle_hint")}>
              <input
                style={{
                  ...field, maxWidth: 240, textTransform: "uppercase",
                  letterSpacing: 1.5, fontWeight: 700,
                  borderColor: f.vehicle_number && !plateLooksRight(f.vehicle_number)
                    ? T.red : undefined,
                }}
                value={f.vehicle_number}
                placeholder="TR 01 AB 1234"
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                onChange={(e) => set("work", "vehicle_number", e.target.value)}
              />
            </Row>
          )}

          <Row label={t("w3_rate")}>
            <div style={{ display: "flex", gap: 9 }}>
              <input style={{ ...field, flex: 1 }} inputMode="numeric" value={f.day_rate_min}
                     placeholder={t("w3_rate_from")}
                     onChange={(e) => set("work", "day_rate_min", e.target.value)} />
              <input style={{ ...field, flex: 1 }} inputMode="numeric" value={f.day_rate_max}
                     placeholder={t("w3_rate_to")}
                     onChange={(e) => set("work", "day_rate_max", e.target.value)} />
            </div>
          </Row>

          <Row label={t("w3_years")}>
            <input style={{ ...field, maxWidth: 160 }} inputMode="numeric"
                   value={f.years_experience}
                   onChange={(e) => set("work", "years_experience", e.target.value)} />
          </Row>

          <Row label={t("w3_about")}>
            <textarea style={{ ...field, minHeight: 90, resize: "vertical" }} value={f.about}
                      placeholder={t("w3_about_ph")}
                      onChange={(e) => set("work", "about", e.target.value)} />
          </Row>
        </Section>
      </div>

      {/* ------------------------------------------------------- contact */}
      <div id="sec-contact">
        <Section
          title={t("p_contact")}
          dirty={dirty.contact} saving={savingKey === "contact"} saved={savedKey === "contact"}
          onSave={async () => {
            if (!f.full_name.trim()) return setErr(t("e_name"));
            if (String(f.phone).replace(/\D/g, "").length < 10) return setErr(t("e_phone"));
            if (!isAdmin && !(await consent.ask("listing"))) return;
            // An exact spot is saved first, as the listing's position; the
            // rest then follows without moving it.
            if (f.pos && f.pos.exact) {
              try { await api.setMyPosition(f.pos.lat, f.pos.lng, f.pos.source); }
              catch (e) { return setErr(e.message || t("e_save")); }
            }
            save("contact", {
              p_full_name: f.full_name.trim(),
              p_phone: f.phone.trim(),
              p_locality: f.locality.trim() || null,
              p_state: f.state,
              // 0, not null: null means "leave alone" everywhere else in
              // this function, so clearing the city needs its own signal. Only
              // when the place was changed: the old town belonged to the old one.
              ...(f.pos ? { p_city_id: 0 } : {}),
              // The PIN code that came with the chosen place.
              ...(f.pin_auto && /^\d{6}$/.test(f.pincode) ? { p_pincode: f.pincode } : {}),
            });
          }}
          note={phoneChanged ? (
            <div style={{
              padding: "11px 13px", borderRadius: 10, marginBottom: 14,
              background: T.accentSoft, border: `1px solid rgba(248,118,23,0.35)`,
              color: "#8A4A00", fontSize: 13, lineHeight: 1.55,
            }}>{t("p_phone_warn")}</div>
          ) : null}
        >
          <Row label={t("w2_name")}>
            <input style={field} value={f.full_name}
                   onChange={(e) => set("contact", "full_name", e.target.value)} />
          </Row>

          <Row label={t("w2_phone")} hint={phoneChanged ? null : t("w2_phone_hint")}>
            <div style={{ ...field, display: "flex", alignItems: "center", gap: 9, padding: "0 14px" }}>
              <span style={{ fontSize: 16, color: T.inkFaint, fontWeight: 600 }}>+91</span>
              <input value={f.phone} type="tel" inputMode="numeric"
                     onChange={(e) => set("contact", "phone", e.target.value)}
                     style={{ flex: 1, border: "none", outline: "none", fontSize: 16,
                              minWidth: 0, padding: "13px 0", background: "transparent",
                              fontFamily: "inherit", color: T.ink }} />
            </div>
          </Row>

          {/* ONE QUESTION: where. Type a road, a shop or a village and tap it,
              or use the phone's position, then move the pin to the exact
              door. State, PIN code and address follow from the spot. */}
          <Row label={t("w2_area")}>
            <PlaceField
              value={f.locality ? { area: f.locality, state: f.state, pin: f.pincode, exact: f.pos ? f.pos.exact : undefined } : null}
              sheetPlace={{ state: f.state, area: f.locality }}
              onChange={(p) => {
                setF((prev) => ({
                  ...prev,
                  locality: p.area, state: p.state || prev.state,
                  pincode: p.pin || prev.pincode, pin_auto: true,
                  // The town picked before belonged to the old place.
                  city_id: null, city_name: "", district: "",
                  address_line: prev.address_line || (p.exact && p.address ? p.address : ""),
                  pos: typeof p.lat === "number" ? { lat: p.lat, lng: p.lng, source: p.source, exact: !!p.exact } : null,
                }));
                setDirty((d) => ({ ...d, contact: true, address: true }));
              }}
            />
          </Row>
        </Section>
      </div>

      {/* ------------------------------------------------------- address */}
      <div id="sec-address">
        <Section
          title={t("p_address")}
          dirty={dirty.address} saving={savingKey === "address"} saved={savedKey === "address"}
          onSave={() => {
            if (f.pincode.trim() && f.pincode.replace(/\D/g, "").length !== 6)
              return setErr(t("e_badpin"));
            save("address", {
              p_address_line: f.address_line.trim() || "-",
              p_landmark: f.landmark.trim() || "-",
              p_pincode: f.pincode.trim() || "-",
              p_address_public: f.address_public,
            });
          }}
        >
          <Row label={t("p_addr_line")}>
            <input style={field} value={f.address_line} placeholder={t("p_addr_line_ph")}
                   onChange={(e) => set("address", "address_line", e.target.value)} />
          </Row>
          <Row label={t("p_landmark")}>
            <input style={field} value={f.landmark} placeholder={t("p_landmark_ph")}
                   onChange={(e) => set("address", "landmark", e.target.value)} />
          </Row>
          <label style={{
            display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
            padding: "13px 14px", borderRadius: 11, minHeight: 52, marginBottom: 14,
            border: `1px solid ${f.address_public ? "rgba(248,118,23,0.45)" : T.line}`,
            background: f.address_public ? T.accentSoft : T.white,
          }}>
            <input type="checkbox" checked={f.address_public} style={{ marginTop: 3 }}
                   onChange={(e) => set("address", "address_public", e.target.checked)} />
            <span>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: T.ink }}>
                {t("p_addr_public")}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft,
                             lineHeight: 1.55, marginTop: 4 }}>
                {t("p_addr_public_hint")}
              </span>
            </span>
          </label>

          {!f.address_public && (
            <div style={{ fontSize: 12.5, color: T.inkFaint, marginBottom: 12, lineHeight: 1.5 }}>
              {t("p_addr_private_note")}
            </div>
          )}
          {f.address_public && (
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
              {t("p_addr_dir_note")}
            </div>
          )}
        </Section>
      </div>

      {/* ------------------------------------------------------------ ID */}
      {ID_UPLOADS_ENABLED && (
        <div id="sec-id">
          {/* "(optional)" is a lie for a cook or a driver, and it sat directly
              above a red notice saying so. The label follows the trade. */}
          <Section title={row.requires_id && !row.verified ? t("adm_id_title") : t("p_id")}>
            {/* For a cook or a driver this is not optional any more, and
                the screen has to say so plainly rather than letting somebody
                discover it when an admin refuses them. */}
            {row.requires_id && !row.verified && (
              <Notice tone={row.has_id_doc ? "info" : "bad"}>
                {t("p_id_required")}
              </Notice>
            )}
            <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6, margin: "12px 0 6px" }}>
              {t("p_id_body")}
            </p>
            {/* Said every time, right above the button. Most people here will
                reach for Aadhaar because it is the card they have, and the
                number is the part that must not be collected -- see the
                header of 60 and 67 for why that matters legally. */}
            <p style={{ fontSize: 12.5, color: T.inkFaint, lineHeight: 1.6, margin: "0 0 14px" }}>
              {t("p_id_which")}
            </p>
            {row.has_id_doc ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "13px 14px",
                borderRadius: 11, background: T.brandSoft,
                border: `1px solid rgba(5,66,145,0.22)`,
              }}>
                <span style={{ color: T.brandDark }}><Icon name="check" size={19} /></span>
                <span style={{ flex: 1, fontSize: 14, color: T.brandDeep, fontWeight: 600 }}>
                  {t("p_id_pending")}
                </span>
                <button onClick={removeId} style={{
                  background: "none", border: "none", cursor: "pointer", color: T.red,
                  fontWeight: 700, fontSize: 13.5, minHeight: 40, fontFamily: "inherit",
                }}>{t("p_remove")}</button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => idInput.current && idInput.current.click()}
                  disabled={uploading}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 9, padding: "13px 14px", borderRadius: 11, minHeight: 52,
                    border: `1.5px dashed ${T.line}`, background: T.paper,
                    color: T.brandDark, fontSize: 14.5, fontWeight: 700,
                    cursor: uploading ? "default" : "pointer", fontFamily: "inherit",
                  }}>
                  <Icon name="download" size={18} style={{ transform: "rotate(180deg)" }} />
                  {uploading ? t("p_uploading") : t("p_id_upload")}
                </button>
                <input ref={idInput} type="file" accept="image/*" capture="environment"
                       style={{ display: "none" }}
                       onChange={(e) => uploadId(e.target.files && e.target.files[0])} />
              </>
            )}
          </Section>
        </div>
      )}

      {/* ------------------------------------------------------ delete
          Last on the page, on purpose: nothing below it, and a long way
          from anything somebody taps routinely. Quiet until pressed --
          a permanently red block at the bottom of a page teaches people
          to scroll past warnings. */}
      <div style={{
        marginTop: 30, paddingTop: 20, borderTop: `1px solid ${T.line}`,
        display: "flex", justifyContent: "center",
      }}>
        <button onClick={() => setConfirmDel(true)} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "none", border: "none", cursor: "pointer",
          color: T.red, fontSize: 14, fontWeight: 700, minHeight: 46,
          fontFamily: "inherit", padding: "0 10px",
        }}>
          <Icon name="trash" size={17} />
          {t("del_mine_cta")}
        </button>
      </div>

      {confirmDel && (
        <ConfirmDelete
          title={t("del_mine_title")}
          body={t("del_mine_body")}
          busy={deleting}
          onCancel={() => setConfirmDel(false)}
          onConfirm={async () => {
            setDeleting(true); setErr(null);
            try {
              const r = await api.deleteMyListing();
              const one = Array.isArray(r) ? r[0] : r;
              if (one && one.ok) {
                setConfirmDel(false);
                // Back to the empty state rather than a screen describing a
                // listing that no longer exists.
                setRow(null);
                if (onGoAdd) load();
              } else {
                setErr(t("del_failed"));
              }
            } catch (_) {
              setErr(t("del_failed"));
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
    </div>
  );
}
