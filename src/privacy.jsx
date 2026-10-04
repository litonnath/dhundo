// ---------------------------------------------------------------------------
// PRIVACY: the notice, the grievance contact, and the "My data" screen.
// Texts of the notice are in notice.js (12 languages); the labels of My data
// are in i18n.jsx and fall back to English where a language has none yet.
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from "react";
import { T, Btn, CloseButton, useDismissable, input, Notice } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { NOTICE } from "./notice.js";
import { CONTACT, GRIEVANCE } from "./brand.jsx";
import { PrivacyLink } from "./consent-ui.jsx";

const arr = (x) => (Array.isArray(x) ? x[0] : x);

export function NoticeBody() {
  const { lang } = useI18n();
  const n = NOTICE[lang] || NOTICE.en;
  const fill = (s) => s.replace("{who}", GRIEVANCE.name).replace("{wa}", `+${CONTACT.whatsapp.replace(/^91/, "91 ")}`);
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: "0 0 2px" }}>{n.title}</h1>
      <div style={{ fontSize: 12.5, color: T.inkFaint, marginBottom: 14 }}>{n.updated}</div>
      {n.s.map(([h, body], i) => (
        <section key={i} style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, margin: "0 0 3px" }}>{h}</h2>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.65, margin: 0 }}>{fill(body)}</p>
        </section>
      ))}
      <GrievanceCard />
    </div>
  );
}

export function GrievanceCard() {
  const { t } = useI18n();
  return (
    <div style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", marginTop: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft }}>{t("gr_title")}</div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, marginTop: 2 }}>{GRIEVANCE.name}</div>
      <a href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noopener noreferrer"
         style={{ color: T.brandDark, fontWeight: 700, fontSize: 14 }}>WhatsApp +{CONTACT.whatsapp}</a>
      {CONTACT.email && <div><a href={`mailto:${CONTACT.email}`} style={{ color: T.brandDark, fontSize: 14 }}>{CONTACT.email}</a></div>}
      <div style={{ fontSize: 12.5, color: T.inkFaint, marginTop: 4 }}>{t("gr_time")}</div>
    </div>
  );
}

export function NoticeSheet({ onClose }) {
  useDismissable(true, onClose);
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,20,25,0.55)",
                  display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 520,
                    padding: "8px 18px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><CloseButton onClick={onClose} /></div>
        <NoticeBody />
      </div>
    </div>
  );
}

// The page at /privacy: what the Play Store and the website footer link to.
export function NoticePage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 18px 40px", background: T.white,
                  minHeight: "100vh", boxSizing: "border-box",
                  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <a href="/" style={{ color: T.brandDark, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>← Dhundo</a>
      <div style={{ height: 10 }} />
      <NoticeBody />
    </div>
  );
}

const linkBtn = {
  background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
  color: T.inkFaint, fontSize: 13, fontWeight: 600, textDecoration: "underline",
  minHeight: 40, padding: "6px 10px",
};

// Three quiet links in Account: the notice, my data, and the consent switches.
export function PrivacyLinks({ api }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(null);
  return (
    <>
      <div style={{ textAlign: "center", marginTop: 18, display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
        <button style={linkBtn} onClick={() => setOpen("notice")}>{t("pn_link")}</button>
        <button style={linkBtn} onClick={() => setOpen("data")}>{t("md_link")}</button>
      </div>
      <div style={{ marginTop: -14 }}><PrivacyLink /></div>
      {open === "notice" && <NoticeSheet onClose={() => setOpen(null)} />}
      {open === "data" && <MyDataSheet api={api} onClose={() => setOpen(null)} />}
    </>
  );
}

export function MyDataSheet({ api, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [nom, setNom] = useState({ name: "", phone: "" });
  const [msg, setMsg] = useState("");
  const [req, setReq] = useState({ kind: "access", body: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.myData().then((r) => {
    const d = arr(r);
    if (!d || !d.ok) { setFailed(true); return; }
    setData(d);
    setNom({ name: (d.account && d.account.nominee_name) || "", phone: (d.account && d.account.nominee_phone) || "" });
  }).catch(() => setFailed(true));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const download = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-dhundo-data.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const saveNominee = async () => {
    setBusy(true); setMsg("");
    try {
      const r = arr(await api.setNominee(nom.name, nom.phone));
      setMsg(r && r.ok ? t("md_saved") : t("e_gone"));
    } catch (e) { setMsg((e && e.message) || t("e_gone")); }
    setBusy(false);
  };
  const sendReq = async () => {
    setBusy(true); setMsg("");
    try {
      const r = arr(await api.privacyRequest(req.kind, req.body));
      setMsg(r && r.ok ? t("md_sent") : t("e_gone"));
      if (r && r.ok) { setReq({ kind: "access", body: "" }); load(); }
    } catch (e) { setMsg((e && e.message) || t("e_gone")); }
    setBusy(false);
  };

  const kinds = ["access", "correct", "erase", "grievance", "other"];
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,20,25,0.55)",
                  display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 520,
                    padding: "8px 18px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ flex: 1, fontSize: 20, fontWeight: 800, margin: 0, color: T.ink }}>{t("md_title")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6 }}>{t("md_body")}</p>
        {failed && <Notice tone="bad">{t("e_gone")}</Notice>}
        {!data && !failed && <div style={{ color: T.inkFaint }}>…</div>}
        {data && (
          <>
            <div style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.8, color: T.ink }}>
              <div><b>{t("md_account")}:</b> {data.account && data.account.name} · {data.account && data.account.phone}</div>
              <div><b>{t("md_listings")}:</b> {(data.listings || []).length}{data.has_id_document ? ` · ${t("md_id")}` : ""}</div>
              <div><b>{t("md_wallet")}:</b> {(data.wallet || []).length} · {(data.withdrawals || []).length}</div>
              <div><b>{t("md_consents")}:</b> {(data.consents || []).filter((c) => c.granted).length}/{(data.consents || []).length}</div>
            </div>
            <div style={{ marginTop: 10 }}><Btn full kind="ghost" onClick={download}>{t("md_download")}</Btn></div>

            <h2 style={{ fontSize: 15.5, fontWeight: 800, margin: "18px 0 4px", color: T.ink }}>{t("md_nominee")}</h2>
            <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 8 }}>{t("md_nominee_b")}</div>
            <input style={{ ...input, marginBottom: 8 }} value={nom.name} maxLength={80} placeholder={t("md_nominee_name")}
                   onChange={(e) => setNom((n) => ({ ...n, name: e.target.value }))} />
            <input style={{ ...input, marginBottom: 8 }} value={nom.phone} maxLength={14} inputMode="numeric" placeholder={t("md_nominee_phone")}
                   onChange={(e) => setNom((n) => ({ ...n, phone: e.target.value }))} />
            <Btn full disabled={busy} onClick={saveNominee}>{t("md_save")}</Btn>

            <h2 style={{ fontSize: 15.5, fontWeight: 800, margin: "18px 0 4px", color: T.ink }}>{t("md_ask")}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {kinds.map((k) => (
                <button key={k} onClick={() => setReq((r) => ({ ...r, kind: k }))} style={{
                  border: `1px solid ${req.kind === k ? T.brandDark : T.line}`, borderRadius: 18, padding: "7px 12px",
                  background: req.kind === k ? T.brandSoft : T.white, color: T.ink, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700, minHeight: 36,
                }}>{t("md_k_" + k)}</button>
              ))}
            </div>
            <textarea style={{ ...input, width: "100%", minHeight: 80, boxSizing: "border-box", marginBottom: 8 }}
                      value={req.body} maxLength={1000} placeholder={t("md_ask_ph")}
                      onChange={(e) => setReq((r) => ({ ...r, body: e.target.value }))} />
            <Btn full disabled={busy} onClick={sendReq}>{t("md_send")}</Btn>
            {(data.requests || []).length > 0 && (
              <div style={{ fontSize: 12.5, color: T.inkFaint, marginTop: 8 }}>
                {(data.requests || []).map((r, i) => (
                  <div key={i}>{t("md_k_" + r.kind)} · {new Date(r.at).toLocaleDateString("en-IN")} · {r.status}</div>
                ))}
              </div>
            )}
            {msg && <div style={{ marginTop: 10 }}><Notice tone="info">{msg}</Notice></div>}
          </>
        )}
        <div style={{ marginTop: 16 }}><GrievanceCard /></div>
      </div>
    </div>
  );
}
