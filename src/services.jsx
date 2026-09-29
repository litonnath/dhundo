// ===========================================================================
// services.jsx -- the local services directory.
//
// Data and state only. Everything visual lives in ui.jsx, so the look can be
// reworked without touching a single network call.
//
// PHONE NUMBERS
// A number is never in the browse payload: anon has column-level SELECT on
// every column of services_workers EXCEPT phone, and services_browse_workers
// cannot return one. Tapping Call goes to services_reveal_contact, which
// needs a signed-in caller, logs the reveal and rate limits it. Published
// openly, this directory would become a scraped list of working phone numbers
// and the people on it would get spam calls forever.
//
// PROPS
//   supabaseUrl, anonKey   required
//   user                   { id, email, full_name } or null
//   getAccessToken         async () => string | null
//   isAdmin                boolean -- decides what is OFFERED only; every
//                          privileged call is re-checked server side
//   onSignIn, onSignOut    navigation callbacks
// ===========================================================================
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  T, Icon, Btn, Chip, Notice, input, Header, Hero, CategoryGrid,
  ListingCard, EmptyState, TrustBar, InstallSheet, LocationSheet, OutOfArea,
  AreaField, AreaInput, CityPicker, StateSwitch, StateSelect, groupStyle, groupLabel, WalletSheet,
  plateLooksRight, CloseButton, useDismissable, ConfirmDelete, SiteFooter, LiveDot,
  BottomNav, AccountPage, ProfilePage, InstallBanner, LanguageGate, PopularTrades, matchTrade,
} from "./ui.jsx";
import { snapToKnown } from "./regions.js";
import { hasIndic, variants } from "./translit.js";
import { captureFromUrl, redeemPending } from "./referral.js";
import { useMyLocation, isInstalledApp } from "./device.jsx";
import MyListing from "./profile.jsx";
import { useAvailability, WorkerHome } from "./worker.jsx";
import { useI18n, tradeName, STATES, DEFAULT_STATE, stateName } from "./i18n.jsx";

// ---------------------------------------------------------------- data layer
// How far "near" is for people available right now, and how far to look
// when nobody is that near.
const NEAR_KM = 30;
const FAR_KM = 100;

function makeApi({ supabaseUrl, anonKey, getAccessToken }) {
  const anonHeaders = {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  // Falls back to the anon key rather than throwing when a session has quietly
  // expired: the RPC then refuses on its own terms and says why, which beats a
  // blank screen.
  async function authHeaders() {
    let token = null;
    try { token = getAccessToken ? await getAccessToken() : null; } catch (_) { token = null; }
    return {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${token || anonKey}`,
    };
  }

  async function rpc(name, body, useAuth = false) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: useAuth ? await authHeaders() : anonHeaders,
      body: JSON.stringify(body || {}),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    if (!res.ok) {
      throw new Error((data && (data.message || data.error)) || `Request failed (${res.status})`);
    }
    return data;
  }

  return {
    listTrades: (onlyWithListings = false, state = null) =>
      rpc("services_list_trades", { p_only_with_listings: onlyWithListings, p_state: state }),
    browse: (o = {}) =>
      rpc("services_browse_workers", {
        p_trade: o.trade || null, p_locality: o.locality || null,
        p_search: o.search || null, p_group: o.group || null,
        p_kind: o.kind || null, p_state: o.state || null,
        p_limit: o.limit || 50, p_offset: o.offset || 0,
        // With coordinates, 63 stops filtering by area name and sorts by
        // real distance instead. Without them it behaves exactly as before,
        // so a person who refuses the location permission loses the
        // ordering and nothing else.
        p_lat: typeof o.lat === "number" ? o.lat : null,
        p_lng: typeof o.lng === "number" ? o.lng : null,
        p_radius_km: o.radiusKm || null,
      }),
    // No viewer id: 59 reads it from the signed token. Passing one was how
    // a caller could spend somebody else's hourly reveal budget.
    reveal: (workerId) => rpc("services_reveal_contact", { p_worker_id: workerId }, true),

    // ------------------------------------------------- available now (80)
    // The worker's switch. p_hours given = go online for that long; null =
    // a heartbeat that only moves the position. The account comes from the
    // signed token, never from here.
    setAvailability: (on, pos, hours) =>
      rpc("services_set_availability", {
        p_on: !!on,
        p_lat: pos ? pos.lat : null, p_lng: pos ? pos.lng : null,
        p_accuracy: pos && typeof pos.accuracy === "number" ? Math.round(pos.accuracy) : null,
        p_hours: hours || null,
      }, true),
    myAvailability: () => rpc("services_my_availability", {}, true),
    // ------------------------------------------------- account profile (83)
    // About the person, not their work: that is the listing.
    myProfile: () => rpc("services_my_profile", {}, true),
    updateMyProfile: (p) =>
      rpc("services_update_my_profile", {
        p_full_name: p.full_name || "", p_email: p.email || null,
        p_address: p.address || null, p_city: p.city || null,
        p_state: p.state || null, p_pincode: p.pincode || null,
      }, true),
    // Anyone can ask: the answer is cards and distances, never positions.
    availableWorkers: (o = {}) =>
      rpc("services_available_workers", {
        p_lat: typeof o.lat === "number" ? o.lat : null,
        p_lng: typeof o.lng === "number" ? o.lng : null,
        p_state: o.state || null, p_trade: o.trade || null, p_group: o.group || null,
        p_radius_km: o.radiusKm || NEAR_KM, p_limit: o.limit || 20,
      }),
    selfRegister: (p) => rpc("services_self_register", p, true),
    adminUpsert: (p) => rpc("services_admin_upsert", p, true),
    adminList: (status, limit = 200, state = null) =>
      rpc("services_admin_list", { p_status: status || null, p_limit: limit, p_offset: 0, p_state: state }, true),
    adminSetStatus: (id, status, verified, reason) =>
      rpc("services_admin_set_status",
          { p_worker_id: id, p_status: status, p_verified: verified,
            p_reason: reason || null }, true),
    adminDetail: (id) => rpc("services_admin_worker_detail", { p_worker_id: id }, true),

    // A short-lived link to a file in the PRIVATE bucket. Supabase mints it
    // only because 60 gave admins a storage SELECT policy on services-ids;
    // for anybody else this call returns 400 and no URL exists at all.
    //
    // Sixty seconds, deliberately: long enough to look at an ID, short
    // enough that a link pasted into a chat is dead before it arrives. The
    // document is about to be destroyed at verification anyway.
    async signedIdUrl(path) {
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/sign/services-ids/${encodeURI(path)}`,
        {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ expiresIn: 60 }),
        }
      );
      if (!res.ok) throw new Error("no_access");
      const data = await res.json();
      return `${supabaseUrl}/storage/v1${data.signedURL || data.signedUrl}`;
    },

    // ---------------------------------------------------------- profile
    myListing: () => rpc("services_my_listing", {}, true),
    setMyLocation: (lat, lng) =>
      rpc("services_set_my_location", { p_lat: lat, p_lng: lng }, true),
    updateMyListing: (p) => rpc("services_update_my_listing", p, true),
    discardIdDoc: () => rpc("services_discard_id_doc", {}, true),
    deleteMyListing: () => rpc("services_delete_my_listing", {}, true),
    adminDeleteListing: (id) =>
      rpc("services_admin_delete_listing", { p_worker_id: id }, true),
    // ------------------------------------------------- storage sweeping
    //
    // Supabase forbids deleting a storage object from SQL, so the database
    // can only QUEUE a file for destruction (73). Something holding an HTTP
    // client has to finish the job, and the admin's browser is the only
    // thing that reliably has both the permission and a reason to be here.
    //
    // Run after every admin action that might queue something. Failures are
    // reported back so a file that cannot be removed shows up as an attempt
    // count rather than vanishing from the queue.
    pendingDeletions: (limit = 50) =>
      rpc("services_pending_deletions", { p_limit: limit }, true),
    markDeleted: (id, error) =>
      rpc("services_mark_deleted", { p_id: id, p_error: error || null }, true),
    async flushDeletions() {
      let rows;
      try { rows = many(await this.pendingDeletions(50)); }
      catch (_) { return 0; }
      let gone = 0;
      for (const row of rows) {
        try {
          const res = await fetch(
            `${supabaseUrl}/storage/v1/object/${row.bucket_id}/${encodeURI(row.name)}`,
            { method: "DELETE", headers: await authHeaders() }
          );
          // A 404 means somebody already removed it -- which is the outcome
          // we wanted, so it counts as done rather than as a failure to
          // retry forever.
          if (res.ok || res.status === 404) {
            await this.markDeleted(row.id, null);
            gone += 1;
          } else {
            // Storage says 400 for most things, including "not found" and
            // "not allowed"; the body is the only place that tells them apart.
            let msg = "";
            try { const b = await res.json(); msg = b.message || b.error || ""; }
            catch (_) { /* not JSON */ }
            await this.markDeleted(row.id, `HTTP ${res.status}${msg ? ` ${msg}` : ""}`);
          }
        } catch (e) {
          await this.markDeleted(row.id, String((e && e.message) || "failed"));
        }
      }
      return gone;
    },

    // p_block is now the CALLER's choice rather than always true.
    //
    // It used to be hardcoded on, which made "remove this test account" and
    // "ban this person for good" the same button. Deleting somebody barred
    // their phone number permanently, with no way back except SQL, and no
    // warning that it had happened.
    adminDeleteAccount: (accountId, reason, block) =>
      rpc("services_admin_delete_account",
          { p_account_id: accountId, p_block: !!block, p_reason: reason || null }, true),
    adminUnblockPhone: (phone) =>
      rpc("services_admin_unblock_phone", { p_phone: phone }, true),

    // ----------------------------------------------------------- wallet
    //
    // Both of these read the account from the signed token, not from
    // anything sent here -- there is no account id to pass, on purpose.
    // Amounts come back in PAISE as an integer; see rupees() before
    // showing one to anybody.
    cities: (state, q) =>
      rpc("services_cities", { p_state: state, p_q: q || null, p_limit: 200 }),
    pincodeLookup: (pin) => rpc("services_pincode_lookup", { p_pin: pin }),
    walletBalance: () => rpc("services_wallet_balance", {}, true),
    myReferrals: () => rpc("services_my_referrals", {}, true),
    applyReferral: (code) => rpc("services_apply_referral", { p_code: code }, true),
    walletHistory: (limit = 50) =>
      rpc("services_wallet_history", { p_limit: limit }, true),

    // ---------------------------------------------------------- uploads
    //
    // Straight to Supabase Storage rather than through a function: a photo
    // taken on a phone is a megabyte or two, and base64-ing that through
    // PostgREST would be slower and would put image bytes in the database.
    //
    // The object name always starts with the caller's account id, because
    // the storage policies in 60 compare that first path segment against
    // services_account_id(). Anything else is rejected by the database, not
    // merely discouraged here.
    async upload(bucket, file, accountId) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const rand = Math.random().toString(36).slice(2, 10);
      const path = `${accountId}/${Date.now()}-${rand}.${ext}`;
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${(await (getAccessToken ? getAccessToken() : null)) || anonKey}`,
            "Content-Type": file.type || "application/octet-stream",
            "x-upsert": "false",
          },
          body: file,
        }
      );
      if (!res.ok) {
        const body = await res.text();
        // 413 is the bucket's own size limit doing its job; say that rather
        // than showing a raw status code to somebody holding a phone.
        throw new Error(res.status === 413 ? "too_large" : (body || `Upload failed (${res.status})`));
      }
      return path;
    },
  };
}

const one = (r) => (Array.isArray(r) ? r[0] || null : r || null);
const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);

// The "/day" suffix is passed in rather than hardcoded: it read as English
// in the middle of an otherwise Bengali card. The rupee amount itself stays
// in Indian digit grouping in every language, because that is how the
// number is written here regardless of the script around it.
function rateLabel(min, max, suffix = "/day") {
  if (!min && !max) return null;
  const f = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  const range = min && max && min !== max ? `${f(min)}–${f(max)}` : `${f(min || max)}`;
  return `${range}${suffix}`;
}

// -------------------------------------------------------------------- browse
function Browse({ api, trades, user, isAdmin, onSignIn, onAdd, place, setPlace, onInstall }) {
  const { t, lang } = useI18n();
  const geo = useMyLocation();
  const [group, setGroup] = useState(null);
  const [trade, setTrade] = useState(null);
  const [search, setSearch] = useState("");
  // The area and the state are set in the header and owned by the page, so
  // there is one answer to "where am I looking?" rather than two.
  const locality = (place && place.area) || "";
  const state = (place && place.state) || DEFAULT_STATE;
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revealing, setRevealing] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [note, setNote] = useState(null);
  const timer = useRef(null);

  // Deliberately not a function of the area. The area is detected on first
  // load, so folding it in here would mean the category grid vanished the
  // moment we learned where somebody was -- straight into an empty result
  // list for a category they had not picked yet.
  const showGrid = !group && !trade && !search.trim();

  // Typed in any language: a word that names a trade ("প্লাম্বার",
  // "nalwala") searches that trade, since the listings themselves are
  // stored in English and a text search for it would find nothing.
  const typedTrade = useMemo(
    () => (!trade && search.trim() ? matchTrade(search, trades) : null),
    [search, trade, trades]);

  const load = useCallback(() => {
    if (showGrid) { setList([]); setTotal(0); return; }
    setLoading(true);
    setError(null);
    // A name or place typed in any Indian script is searched under each
    // likely English spelling ("সুকান্ত" -> sukant, sukanta), because
    // that is how listings are stored; the results are merged.
    const text = typedTrade ? null : search;
    const spellings = text && hasIndic(text) ? variants(text, 4) : [text];
    Promise.all(spellings.map((sp) =>
      api.browse({ trade: trade || (typedTrade && typedTrade.slug),
                   group: typedTrade ? null : group,
                   search: sp, locality, state,
                   lat: place && place.lat, lng: place && place.lng })
        .then(many).catch(() => [])))
      .then((sets) => {
        const seen = new Set();
        const rowsOut = [];
        sets.forEach((set) => set.forEach((row) => {
          if (!seen.has(row.id)) { seen.add(row.id); rowsOut.push(row); }
        }));
        setList(rowsOut);
        setTotal(spellings.length > 1 ? rowsOut.length
                 : rowsOut.length ? Number(rowsOut[0].total_count) : 0);
      })
      .catch((e) => setError(e.message || t("e_load")))
      .finally(() => setLoading(false));
  }, [api, trade, group, search, typedTrade, locality, state, showGrid,
      place && place.lat, place && place.lng]);

  // ----------------------------------------------------- available now (80)
  // Who can take work right now, nearest by where they are NOW. Fetched
  // beside the ordinary search and refreshed every minute, so a worker who
  // switches on shows up without anybody pulling to refresh. On the home
  // screen it is everyone nearby; inside a category, that category.
  const [live, setLive] = useState([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  // True when nobody is live within NEAR_KM and the list shows the nearest
  // people farther out instead -- better a driver 40 km away who can be
  // called than an empty screen.
  const [liveFar, setLiveFar] = useState(false);
  const [onlyLive, setOnlyLive] = useState(false);
  useEffect(() => {
    let alive = true;
    const fetchLive = () =>
      api.availableWorkers({
        lat: place && place.lat, lng: place && place.lng, state,
        trade: showGrid ? null : (trade || (typedTrade && typedTrade.slug)),
        group: showGrid || typedTrade ? null : group,
        limit: showGrid ? 8 : 20,
        radiusKm: FAR_KM,
      })
        .then((r) => {
          if (!alive) return;
          let rows = many(r);
          // A typed search narrows the live list the same way it narrows
          // the ordinary one, by name, trade or area.
          const q = typedTrade ? "" : search.trim();
          if (q) {
            const qs = variants(q, 8).map((v) => v.toLowerCase());
            rows = rows.filter((x) =>
              [x.display_name, x.trade_name, x.locality, x.city]
                .some((v) => qs.some((w) => String(v || "").toLowerCase().includes(w))));
          }
          // Everyone within NEAR_KM when there is anyone; otherwise the
          // nearest farther out, marked as such. Without the customer's
          // position there is no distance to split on.
          const near = rows.filter((x) => x.distance_km == null || Number(x.distance_km) <= NEAR_KM);
          const far = near.length === 0 && rows.length > 0;
          setLive(far ? rows : near);
          setLiveFar(far);
          setLiveLoaded(true);
        })
        .catch(() => { if (alive) { setLive([]); setLiveFar(false); setLiveLoaded(true); } });
    fetchLive();
    const id = setInterval(fetchLive, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [api, state, trade, group, showGrid, search, typedTrade, place && place.lat, place && place.lng]);

  // Available first, then everybody else once; the live copy of a card wins
  // because its distance is from where the worker is now.
  const liveIds = useMemo(() => new Set(live.map((r) => r.id)), [live]);
  const shown = onlyLive ? live : [...live, ...list.filter((r) => !liveIds.has(r.id))];

  // Debounced: one request per pause, not one per keystroke. On the
  // connections this audience has, that is the difference between usable and
  // not.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 280);
    return () => timer.current && clearTimeout(timer.current);
  }, [load]);

  const handleCall = async (row) => {
    setNote(null);
    if (!user || !user.id) {
      setNote(t("signin_first"));
      if (onSignIn) onSignIn();
      return;
    }
    setRevealing(row.id);
    try {
      const r = one(await api.reveal(row.id));
      if (r && r.ok) {
        setRevealed((p) => ({ ...p, [row.id]: r.phone }));
        // One tap should be a call. The number stays on the card too, with
        // WhatsApp beside it, for anybody who would rather message.
        try { window.location.href = `tel:${String(r.phone).replace(/\s/g, "")}`; } catch (_) {}
      }
      else setNote(
        r && r.reason === "rate_limited"
          ? t("e_rate")
          : r && r.reason === "sign_in_required"
          ? t("e_signin")
          : t("e_gone")
      );
    } catch (e) {
      setNote(e.message || t("e_gone"));
    } finally {
      setRevealing(null);
    }
  };

  const groups = useMemo(() => {
    const out = [];
    trades.forEach((t) => { if (!out.includes(t.group_name)) out.push(t.group_name); });
    return out;
  }, [trades]);

  const counts = useMemo(() => {
    const out = {};
    trades.forEach((t) => {
      out[t.group_name] = (out[t.group_name] || 0) + Number(t.listing_count || 0);
    });
    return out;
  }, [trades]);

  const inGroup = group ? trades.filter((t) => t.group_name === group) : [];

  // slug -> name in the current language, for the "also does" chips. Built
  // once per render of the list rather than per card.
  const tradeLabels = useMemo(() => {
    const out = {};
    trades.forEach((tr) => { out[tr.slug] = tradeName(tr, lang); });
    return out;
  }, [trades, lang]);

  return (
    <>
      <Hero search={search} setSearch={setSearch} compact={!showGrid} onVoice={(said) => {
        // A trade name, in any language, goes straight to that trade;
        // anything else becomes an ordinary search.
        const tr = matchTrade(said, trades);
        if (tr) { setSearch(""); setGroup(tr.group_name); setTrade(tr.slug); }
        else setSearch(said);
      }} />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "62px 16px 60px" }}>
        {showGrid ? (
          <>
            {/* Home, in the order a first-time visitor needs it: the jobs
                people ask for most as big tiles, one tap to people; who can
                come right now; then every category. */}
            <InstallBanner onOpen={onInstall} />
            <h2 style={{ fontSize: 19, fontWeight: 800, color: T.ink, margin: "0 0 12px" }}>
              {t("what_need")}
            </h2>
            <PopularTrades trades={trades}
                           onPick={(tr) => { setGroup(tr.group_name); setTrade(tr.slug); }} />
            {live.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <h2 style={{
                  fontSize: 18, fontWeight: 800, color: T.ink, margin: "0 0 12px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <LiveDot /> {liveFar ? t("av_far_title").replace("{n}", NEAR_KM) : t("av_near")}
                </h2>
                {liveFar && (
                  <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, margin: "-4px 0 12px" }}>
                    {t("av_far_note")}
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {live.slice(0, 5).map((row) => (
                    <ListingCard
                      key={row.id}
                      row={row}
                      rate={rateLabel(row.day_rate_min, row.day_rate_max, t("per_day"))}
                      tradeLabel={tradeName(trades.find((x) => x.slug === row.trade_slug), lang) || row.trade_name}
                      trade={trades.find((x) => x.slug === row.trade_slug)}
                      canCall={!!(user && user.id)}
                      revealing={revealing === row.id}
                      revealed={revealed[row.id]}
                      onCall={handleCall}
                      otherLabels={tradeLabels}
                    />
                  ))}
                </div>
              </div>
            )}

            <h2 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: "28px 0 12px" }}>
              {t("all_categories")}
            </h2>
            <CategoryGrid groups={groups} counts={counts} onPick={setGroup} />
            <TrustBar />
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <button
                onClick={() => { setGroup(null); setTrade(null); setSearch(""); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, background: "none",
                  border: "none", cursor: "pointer", color: T.brandDark, fontWeight: 700,
                  fontSize: 14, padding: 0, minHeight: 44, fontFamily: "inherit",
                }}
              >
                <Icon name="back" size={17} /> {t("all_categories")}
              </button>
              {group && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 7, fontSize: 15,
                  fontWeight: 800, color: T.ink,
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: groupStyle(group).bg, color: groupStyle(group).fg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon name={groupStyle(group).icon} size={16} />
                  </span>
                  {groupLabel(group, lang)}
                </span>
              )}
            </div>

            {group && inGroup.length > 0 && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
                <Chip active={!trade} onClick={() => setTrade(null)}>{t("all")}</Chip>
                {inGroup.map((tr) => (
                  <Chip key={tr.slug} active={trade === tr.slug} onClick={() => setTrade(tr.slug)}>
                    {tradeName(tr, lang)}
                    {Number(tr.listing_count) > 0 && (
                      <span style={{ opacity: 0.6 }}> · {tr.listing_count}</span>
                    )}
                  </Chip>
                ))}
              </div>
            )}

            {note && <Notice tone="bad">{note}</Notice>}
            {error && <Notice tone="bad">{error}</Notice>}

            {/* Ordering is the database's -- 63 sorts by real distance once
                it is given coordinates. This line exists so the person can
                SEE which ordering they are getting, and turn the better one
                on if they have not granted the permission yet. Without
                coordinates the results are still complete, just not sorted
                by how far away anyone is. */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
              flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 13, color: T.inkFaint }}>
                {loading ? t("searching")
                  : total === 0 ? ""
                  : `${total} ${total === 1 ? t("result") : t("results")}`}
              </span>
              {/* The Rapido question -- who can come NOW -- as one tap. */}
              {live.length > 0 && (
                <button onClick={() => setOnlyLive((v) => !v)} aria-pressed={onlyLive} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  borderRadius: 20, padding: "7px 12px", minHeight: 38, cursor: "pointer",
                  fontSize: 12.5, fontWeight: 800, fontFamily: "inherit",
                  border: `1.5px solid ${onlyLive ? T.green : "rgba(18,128,74,0.35)"}`,
                  background: onlyLive ? T.green : T.greenSoft,
                  color: onlyLive ? "#fff" : T.green,
                }}>
                  <LiveDot light={onlyLive} /> {t("av_filter")} · {live.length}
                </button>
              )}
              <span style={{ flex: 1 }} />
              {typeof (place && place.lat) === "number" ? (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 12.5, fontWeight: 700, color: T.brandDark,
                }}>
                  <Icon name="crosshair" size={15} /> {t("near_first")}
                </span>
              ) : geo.supported ? (
                <button
                  onClick={async () => {
                    const got = await geo.detect();
                    if (!got || typeof got.lat !== "number") return;
                    setPlace((p) => ({
                      ...p,
                      area: got.area || p.area,
                      state: got.state && STATES.includes(got.state) ? got.state : p.state,
                      lat: got.lat, lng: got.lng,
                    }));
                  }}
                  disabled={geo.state === "locating"}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: T.brandSoft, border: `1px solid rgba(5,66,145,0.25)`,
                    borderRadius: 20, padding: "7px 12px", fontSize: 12.5,
                    fontWeight: 700, color: T.brandDeep, cursor: "pointer",
                    minHeight: 38, fontFamily: "inherit",
                  }}>
                  <Icon name="crosshair" size={15} />
                  {geo.state === "locating" ? t("loc_detecting") : t("near_on")}
                </button>
              ) : null}
            </div>

            {liveFar && live.length > 0 && (
              <Notice tone="info">
                <b>{t("av_far_title").replace("{n}", NEAR_KM)}</b> {t("av_far_note")}
              </Notice>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {shown.map((row) => (
                <ListingCard
                  key={row.id}
                  row={row}
                  rate={rateLabel(row.day_rate_min, row.day_rate_max, t("per_day"))}
                  tradeLabel={tradeName(trades.find((x) => x.slug === row.trade_slug), lang) || row.trade_name}
                  trade={trades.find((x) => x.slug === row.trade_slug)}
                  canCall={!!(user && user.id)}
                  revealing={revealing === row.id}
                  revealed={revealed[row.id]}
                  onCall={handleCall}
                  otherLabels={tradeLabels}
                />
              ))}
            </div>

            {!loading && shown.length === 0 && <EmptyState isAdmin={isAdmin} onAdd={onAdd} />}
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------- form
//
// WHY THIS IS A WIZARD AND NOT A FORM
// It was one screen with ten labelled fields and a <select> holding 71
// options grouped into eight optgroups. For the person it is aimed at -- a
// mistri or a driver, on a cheap phone, who may read Bengali far better than
// English and may not be confident with forms at all -- that is not a form,
// it is a wall. The native select in particular is unusable: 71 rows in a
// system dropdown, in English, with no icons.
//
// So: three screens, one question each, and only three answers that matter.
//
//   1. what work you do    -- tapped from pictures, never typed
//   2. name, number, area  -- the number is already known, so it is prefilled
//   3. everything else     -- explicitly optional
//
// Nothing is asked twice, and the only required answers are the three the
// listing cannot exist without. Rate, years, languages and "about" were all
// required-LOOKING fields asking for data nobody has to hand while standing
// in a shop.
// ---------------------------------------------------------------------------
function StepDots({ step }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[1, 2, 3].map((n) => (
        <span key={n} style={{
          width: n === step ? 22 : 7, height: 7, borderRadius: 4,
          background: n <= step ? T.brandDark : T.line,
        }} />
      ))}
    </div>
  );
}

function BigField({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: "block", fontSize: 14.5, fontWeight: 700, color: T.ink, marginBottom: 7,
      }}>{label}</label>
      {children}
      {hint && (
        <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
      )}
    </div>
  );
}

// 54px rows and 16.5px text: thumb-sized, and large enough to read at arm's
// length in daylight, which is where this actually gets filled in.
const bigInput = {
  ...input, minHeight: 54, fontSize: 16.5, padding: "14px 15px", borderRadius: 12,
};

function ListingForm({ api, trades, user, isAdmin, onDone, onBack, place, setPlace }) {
  const { t, lang } = useI18n();
  const geo = useMyLocation();

  const [step, setStep] = useState(1);
  const [group, setGroup] = useState(null);
  // A list, not a single value. A mistri who also tiles was previously
  // choosing which half of his work to advertise at the moment he signed
  // up -- and most people never come back to fix that. The FIRST pick is
  // the main trade; the rest become other_trades.
  const [picked, setPicked] = useState([]);
  const [f, setF] = useState(() => ({
    // From the account profile, when there is one. Editable: a shop may be
    // listed under somebody else's name.
    full_name: (user && user.full_name) || "",
    business_name: "",
    // They signed up with their phone number, so asking again is asking a
    // question we already know the answer to. Editable, because somebody may
    // list a shop on a different line.
    //
    // Stripped to the bare ten digits: the account stores it prettified as
    // "+91 98620 12345", and the field already prints its own +91 prefix --
    // which is how it first rendered as "+91 +91 98620 12345".
    phone: String((user && user.phone) || "").replace(/\D/g, "").slice(-10),
    years_experience: "", day_rate_min: "", day_rate_max: "",
    about: "",
    address_line: "", landmark: "", pincode: "",
    vehicle_number: "",
    // The chosen city: its id is what the database derives district and
    // coordinates from, the name and district are kept only to show back.
    city_id: null, city_name: "", district: "",
    verified: false, approve: true,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const togglePick = (slug) => {
    setErr(null);
    setPicked((p) => {
      if (p.includes(slug)) return p.filter((x) => x !== slug);
      if (p.length >= 6) { setErr(t("p_max_trades")); return p; }
      return [...p, slug];
    });
  };

  const chosen = trades.find((x) => x.slug === picked[0]);
  const isSupplier = chosen && chosen.kind === "supplier";
  // Asked only of the trades that actually drive. The flag comes from the
  // database (services_trades.requires_vehicle) rather than a group name
  // hardcoded here, so changing which trades need a plate is an UPDATE and
  // not a release. Any of the picked trades needing one is enough.
  const needsVehicle = picked.some(
    (slug) => (trades.find((x) => x.slug === slug) || {}).requires_vehicle
  );
  const num = (v) => (String(v).trim() === "" ? null : Number(v));

  const groups = useMemo(() => {
    const out = [];
    trades.forEach((x) => { if (!out.includes(x.group_name)) out.push(x.group_name); });
    return out;
  }, [trades]);

  const submit = async () => {
    setErr(null);
    if (!f.full_name.trim()) return setErr(t("e_name"));
    if (String(f.phone).replace(/\D/g, "").length < 10) return setErr(t("e_phone"));
    if (!picked.length) return setErr(t("e_category"));
    if (needsVehicle && !plateLooksRight(f.vehicle_number)) return setErr(t("e_vehicle"));

    setBusy(true);
    try {
      const shared = {
        p_full_name: f.full_name.trim(),
        p_phone: f.phone.trim(),
        p_trade_slug: picked[0],
        p_years_experience: num(f.years_experience),
        p_day_rate_min: num(f.day_rate_min),
        p_day_rate_max: num(f.day_rate_max),
        p_locality: (place.area || "").trim() || null,
        p_city: null,
        p_about: f.about.trim() || null,
        p_languages: [],
        p_photos: [],
        p_business_name: f.business_name.trim() || null,
        p_state: place.state,
      };
      // No caller id in either payload -- 59 takes it from the token.
      const r = one(isAdmin
        ? await api.adminUpsert({ ...shared, p_verified: f.verified, p_approve: f.approve })
        : await api.selfRegister(shared));

      // The address goes in a second call rather than as four more
      // parameters on services_self_register. That function's signature has
      // already been rewritten twice in this project, and every rewrite is
      // a chance to drop a column; update_my_listing already accepts these
      // fields and is the function the profile screen uses anyway.
      if (r && r.ok && !isAdmin &&
          (picked.length > 1 || f.address_line.trim() || f.landmark.trim()
           || f.pincode.trim() || f.vehicle_number.trim() || f.city_id)) {
        try {
          await api.updateMyListing({
            // services_self_register takes one trade; the extra ones go in
            // the same follow-up call as the address rather than widening a
            // signature that has already been rewritten twice.
            p_other_trades: picked.length > 1 ? picked.slice(1) : null,
            p_address_line: f.address_line.trim() || null,
            p_landmark: f.landmark.trim() || null,
            p_pincode: f.pincode.trim() || null,
            p_vehicle_number: f.vehicle_number.trim() || null,
            p_city_id: f.city_id || null,
          });
        } catch (_) {
          // The listing itself succeeded. Losing an optional address is not
          // worth showing an error over -- it can be added from My listing.
        }
      }

      if (r && r.ok) {
        setDone(r.reason === "updated" ? "updated" : "created");
        if (onDone) onDone();
      } else {
        const why = r && r.reason;
        setErr(
          why === "bad_city" ? t("e_city")
          : why === "bad_vehicle" ? t("e_vehicle")
          : why === "phone_taken" ? t("e_taken")
          : why === "bad_phone" ? t("e_badphone")
          : why === "bad_trade" ? t("e_badtrade")
          : why === "bad_state" ? t("e_badstate")
          : why === "not_admin" ? t("e_notadmin")
          : why === "sign_in_required" ? t("e_signin")
          : t("e_save")
        );
      }
    } catch (e) {
      setErr(e.message || t("e_save"));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDone(null); setStep(1); setGroup(null); setErr(null); setPicked([]);
    setF((p) => ({ ...p, full_name: "", business_name: "", about: "",
                   years_experience: "", day_rate_min: "", day_rate_max: "" }));
  };

  // ------------------------------------------------------------------ done
  if (done) {
    return (
      <div style={{
        maxWidth: 520, background: T.white, border: `1px solid ${T.line}`,
        borderRadius: 16, padding: "30px 22px", textAlign: "center",
      }}>
        <span style={{
          display: "inline-flex", width: 62, height: 62, borderRadius: "50%",
          background: T.greenSoft, color: T.green, alignItems: "center",
          justifyContent: "center", marginBottom: 14,
        }}><Icon name="check" size={32} /></span>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
          {isAdmin ? t("ok_title_admin") : t("ok_title")}
        </div>
        <p style={{ fontSize: 14.5, color: T.inkSoft, lineHeight: 1.6, margin: "0 0 20px" }}>
          {isAdmin
            ? (done === "updated" ? t("ok_updated") : t("ok_added"))
            : t("ok_submitted")}
        </p>
        <Btn full onClick={reset}>{t("ok_another")}</Btn>
      </div>
    );
  }

  const card = {
    maxWidth: 560, background: T.white, border: `1px solid ${T.line}`,
    borderRadius: 16, padding: "20px 18px 22px",
  };
  const title = { fontSize: 19, fontWeight: 800, color: T.ink, margin: "0 0 5px" };
  const sub = { fontSize: 14, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 18px" };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {/* Back on every step, always in the same place: to the previous
            step, from a group back to the groups, and from the first
            screen out of "List yourself" altogether. */}
        {(step > 1 || group || onBack) && (
          <button onClick={() => {
            setErr(null);
            if (step > 1) setStep(step - 1);
            else if (group) setGroup(null);
            else if (onBack) onBack();
          }} style={{
            display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
            background: T.white, border: `1px solid ${T.line}`, borderRadius: 22,
            color: T.brandDark, fontWeight: 800, fontSize: 14.5, padding: "0 14px 0 10px",
            minHeight: 42, fontFamily: "inherit",
          }}><Icon name="back" size={18} />{t("w_back")}</button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: T.inkFaint, fontWeight: 700 }}>
          {t("w_step").replace("{n}", String(step))}
        </span>
        <StepDots step={step} />
      </div>

      {err && <Notice tone="bad">{err}</Notice>}

      {/* ------------------------------------------------------ 1. trade */}
      {step === 1 && (
        <>
          <h2 style={title}>{t("w1_title")}</h2>
          <p style={sub}>{t("w1_sub_multi")}</p>

          {picked.length > 0 && (
            <div style={{
              background: T.brandSoft, border: `1px solid rgba(5,66,145,0.2)`,
              borderRadius: 12, padding: "12px 13px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.brandDeep,
                            textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
                {t("w1_picked")}
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {picked.map((slug) => (
                  <Chip key={slug} active onClick={() => togglePick(slug)}>
                    {tradeName(trades.find((x) => x.slug === slug), lang) || slug}
                    <span style={{ opacity: 0.7, marginLeft: 5 }}>×</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {!group ? (
            <div style={{
              display: "grid", gap: "14px 4px",
              gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            }}>
              {groups.map((g) => {
                const st = groupStyle(g);
                return (
                  <button key={g} onClick={() => setGroup(g)} style={{
                    background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                    fontFamily: "inherit",
                  }}>
                    <span style={{
                      width: 54, height: 54, borderRadius: "50%", background: st.bg, color: st.fg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}><Icon name={st.icon} size={26} /></span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.ink,
                                   textAlign: "center", lineHeight: 1.25 }}>
                      {groupLabel(g, lang)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: groupStyle(group).bg, color: groupStyle(group).fg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Icon name={groupStyle(group).icon} size={18} /></span>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, flex: 1 }}>
                  {groupLabel(group, lang)}
                </span>
                <button onClick={() => setGroup(null)} style={{
                  background: "none", border: "none", cursor: "pointer", color: T.brandDark,
                  fontWeight: 700, fontSize: 13.5, minHeight: 40, fontFamily: "inherit",
                }}>{t("w1_change")}</button>
              </div>

              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.inkSoft, marginBottom: 9 }}>
                {t("w1_pick_trade")}
              </div>
              {/* Full-width rows rather than wrapped chips: a trade name in
                  Bengali runs long, and a half-cut chip is not something you
                  tap with confidence. Inside their own scrolling box, about
                  five rows tall: a group like Suppliers has a dozen, and the
                  whole page scrolling pushed "Next" out of sight. */}
              <div style={{
                display: "grid", gap: 8, marginBottom: 14,
                maxHeight: 316, overflowY: "auto", overscrollBehavior: "contain",
                padding: 8, border: `1px solid ${T.line}`, borderRadius: 14,
                background: T.paper,
              }}>
                {trades.filter((x) => x.group_name === group).map((tr) => {
                  const on = picked.includes(tr.slug);
                  return (
                    <button key={tr.slug} onClick={() => togglePick(tr.slug)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "13px 14px", borderRadius: 11, minHeight: 52, cursor: "pointer",
                        border: `1.5px solid ${on ? T.brandDark : T.line}`,
                        background: on ? T.brandSoft : T.white,
                        color: on ? T.brandDeep : T.ink, textAlign: "left",
                        fontSize: 15.5, fontWeight: on ? 800 : 500, fontFamily: "inherit",
                      }}>
                      <span style={{ color: on ? T.brandDark : "transparent", flexShrink: 0 }}>
                        <Icon name="check" size={19} />
                      </span>
                      <span style={{ flex: 1 }}>{tradeName(tr, lang)}</span>
                      {/* Which one is the headline. It is the first thing
                          picked, and saying so stops it looking arbitrary
                          when the card shows one trade and not the others. */}
                      {picked[0] === tr.slug && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: T.brandDeep,
                          background: T.white, border: `1px solid ${T.brandDark}`,
                          padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap",
                        }}>{t("w1_main")}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Other groups stay reachable: plenty of people do work that
                  sits in two of them -- a driver who also does deliveries,
                  a carpenter who sells timber. */}
              <button onClick={() => setGroup(null)} style={{
                display: "inline-flex", alignItems: "center", gap: 6, background: "none",
                border: "none", cursor: "pointer", color: T.brandDark, fontWeight: 700,
                fontSize: 13.5, minHeight: 44, fontFamily: "inherit", padding: 0,
                marginBottom: 14,
              }}>
                <Icon name="back" size={16} /> {t("w1_other_group")}
              </button>
            </>
          )}

          {picked.length > 0 && (
            <Btn full onClick={() => { setErr(null); setStep(2); }}>
              {t("w_next")}
            </Btn>
          )}
        </>
      )}

      {/* ---------------------------------------------- 2. how to reach */}
      {step === 2 && (
        <>
          <h2 style={title}>{t("w2_title")}</h2>
          <p style={sub}>{t("w2_sub")}</p>

          <BigField label={isSupplier ? t("f_owner") : t("w2_name")}>
            <input style={bigInput} value={f.full_name} autoComplete="name"
                   onChange={(e) => set("full_name", e.target.value)} />
          </BigField>

          {isSupplier && (
            <BigField label={t("w2_shop")} hint={t("f_shop_hint")}>
              <input style={bigInput} value={f.business_name}
                     onChange={(e) => set("business_name", e.target.value)} />
            </BigField>
          )}

          <BigField label={t("w2_phone")} hint={t("w2_phone_hint")}>
            <div style={{ ...bigInput, display: "flex", alignItems: "center", gap: 9, padding: "0 15px" }}>
              <span style={{ fontSize: 16.5, color: T.inkFaint, fontWeight: 600 }}>+91</span>
              <input value={f.phone} type="tel" inputMode="numeric" autoComplete="tel"
                     onChange={(e) => set("phone", e.target.value)}
                     style={{ flex: 1, border: "none", outline: "none", fontSize: 16.5,
                              minWidth: 0, padding: "14px 0", background: "transparent",
                              fontFamily: "inherit", color: T.ink }} />
            </div>
          </BigField>

          {/* Typed, not picked. The list cannot hold every para in Tripura,
              and the crosshair that used to sit beside this produced a NAME
              by looking up the nearest listed village -- which is how
              somebody ended up filed under a place they do not live in.
              Coordinates are asked for separately, in My listing, where they
              do what they are actually for: distance. */}
          {/* Three questions, in the order they depend on each other:
              state, then city (from a list), then the para (typed). The
              district is not asked at all -- it follows from the city, so
              asking would be asking somebody to confirm a fact we already
              hold, and giving them a chance to get it wrong. */}
          <BigField label={t("w2_city")} hint={t("w2_city_hint")}>
            <CityPicker
              api={api} state={place.state}
              cityId={f.city_id} cityName={f.city_name}
              onPick={(c) => {
                setF((p) => ({ ...p, city_id: c.id, city_name: c.place,
                               district: c.district || "" }));
              }}
            />
            {f.district && (
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 7 }}>
                {t("w2_district").replace("{d}", f.district)}
              </div>
            )}
            <StateSelect
              value={place.state}
              style={{ marginTop: 10 }}
              onChange={(st) => {
                if (place.state === st) return;
                // A city belongs to a state. Keeping it across a change
                // would file somebody in a city their state does not
                // contain -- the same class of bug as "Champaknagar, Delhi".
                setF((p) => ({ ...p, city_id: null, city_name: "", district: "" }));
                setPlace({ area: "", state: st });
              }}
            />
          </BigField>

          <BigField label={t("w2_area")}>
            <AreaInput state={place.state} value={place.area}
                       onChange={(v) => setPlace({ ...place, area: v })} />
          </BigField>

          <Btn full onClick={() => {
            if (!f.full_name.trim()) return setErr(t("e_name"));
            if (String(f.phone).replace(/\D/g, "").length < 10) return setErr(t("e_phone"));
            setErr(null); setStep(3);
          }}>{t("w_next")}</Btn>
        </>
      )}

      {/* --------------------------------------------------- 3. optional */}
      {step === 3 && (
        <>
          <h2 style={title}>{t("w3_title")}</h2>
          {/* "All optional" stops being true the moment a driver is on this
              step, and a promise the form then breaks is worse than no
              promise at all. */}
          <p style={sub}>{t(needsVehicle ? "w3_sub_vehicle" : "w3_sub")}</p>

          {!isSupplier && (
            <>
              <BigField label={t("w3_rate")}>
                <div style={{ display: "flex", gap: 9 }}>
                  <input style={{ ...bigInput, flex: 1 }} inputMode="numeric" value={f.day_rate_min}
                         placeholder={t("w3_rate_from")}
                         onChange={(e) => set("day_rate_min", e.target.value)} />
                  <input style={{ ...bigInput, flex: 1 }} inputMode="numeric" value={f.day_rate_max}
                         placeholder={t("w3_rate_to")}
                         onChange={(e) => set("day_rate_max", e.target.value)} />
                </div>
              </BigField>

              <BigField label={t("w3_years")}>
                <input style={bigInput} inputMode="numeric" value={f.years_experience}
                       onChange={(e) => set("years_experience", e.target.value)} />
              </BigField>
            </>
          )}

          {/* The one REQUIRED field on an otherwise optional step, and only
              for the trades that drive. The person who gets into the car
              needs to know it is the right car, so this is not decoration:
              it is shown to them with the phone number when they call. */}
          {needsVehicle && (
            <BigField label={t("w3_vehicle")} hint={t("w3_vehicle_hint")}>
              <input
                style={{
                  ...bigInput, textTransform: "uppercase", letterSpacing: 1.5,
                  fontWeight: 700,
                  // Red only once they have typed enough to be wrong, not
                  // the moment the field appears.
                  borderColor: f.vehicle_number && !plateLooksRight(f.vehicle_number)
                    ? T.red : undefined,
                }}
                value={f.vehicle_number}
                placeholder="TR 01 AB 1234"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => set("vehicle_number", e.target.value)}
              />
            </BigField>
          )}

          {/* Optional, and on the optional step on purpose. Asking for a
              house number before the listing exists is asking somebody to
              hand over where they live before they have seen what they get
              for it. */}
          <BigField label={t("p_addr_line")}>
            <input style={bigInput} value={f.address_line} placeholder={t("p_addr_line_ph")}
                   onChange={(e) => set("address_line", e.target.value)} />
          </BigField>

          <BigField label={t("p_landmark")} hint={t("p_addr_private_note")}>
            <input style={bigInput} value={f.landmark} placeholder={t("p_landmark_ph")}
                   onChange={(e) => set("landmark", e.target.value)} />
          </BigField>

          <BigField label={t("p_pincode")}>
            <input style={{ ...bigInput, maxWidth: 200 }} value={f.pincode} inputMode="numeric"
                   maxLength={6} placeholder="799001"
                   onChange={(e) => set("pincode", e.target.value)} />
          </BigField>

          <BigField label={t("w3_about")}>
            <textarea style={{ ...bigInput, minHeight: 92, resize: "vertical" }} value={f.about}
                      placeholder={t("w3_about_ph")}
                      onChange={(e) => set("about", e.target.value)} />
          </BigField>

          {isAdmin && (
            <div style={{ display: "flex", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
              <label style={{ fontSize: 14, color: T.ink, display: "flex", gap: 8,
                              alignItems: "center", cursor: "pointer", minHeight: 44 }}>
                <input type="checkbox" checked={f.approve}
                       onChange={(e) => set("approve", e.target.checked)} />
                {t("f_publish")}
              </label>
              <label style={{ fontSize: 14, color: T.ink, display: "flex", gap: 8,
                              alignItems: "center", cursor: "pointer", minHeight: 44 }}>
                <input type="checkbox" checked={f.verified}
                       onChange={(e) => set("verified", e.target.checked)} />
                {t("f_checked")}
              </label>
            </div>
          )}

          <Btn full onClick={submit} disabled={busy}>
            {busy ? t("w_sending") : isAdmin ? t("w_submit_admin") : t("w_submit")}
          </Btn>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------- admin
// --------------------------------------------------------- admin review
//
// Publishing somebody is a decision about letting a stranger into other
// people's homes and cars. It should not be made from six columns in a list,
// which is all the row gave before this -- name, trade, phone, area, years,
// views. Everything held about the person is here instead, including the
// things the public never sees: the exact address, the coordinates, the
// vehicle number, and the ID document itself.
//
// THE ID IMAGE. It lives in a private bucket. This fetches a signed URL that
// dies after sixty seconds and never renders it unless an admin asks -- a
// document should not be sitting on screen in a coffee shop because somebody
// opened a panel. The image is destroyed by the database the moment
// "Checked" is pressed, so this is usually the only time it is ever seen.
function AdminReview({ api, trades, workerId, onClose, onChanged }) {
  const { t, lang } = useI18n();
  useDismissable(true, onClose);
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [idUrl, setIdUrl] = useState(null);
  const [idErr, setIdErr] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmAcct, setConfirmAcct] = useState(false);
  // Hiding opens a box rather than acting immediately: the person is going
  // to read whatever is typed here, and "why" is the part that lets them
  // come back rather than just disappear.
  const [hiding, setHiding] = useState(false);
  const [hideWhy, setHideWhy] = useState("");

  useEffect(() => {
    let alive = true;
    api.adminDetail(workerId)
      .then((r) => { if (alive) setD(one(r)); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [api, workerId]);

  const showId = async () => {
    setIdErr(false);
    try { setIdUrl(await api.signedIdUrl(d.id_doc_path)); }
    catch (_) { setIdErr(true); }
  };

  const act = async (status, verified, why) => {
    setBusy(true); setErr(null);
    try {
      const r = one(await api.adminSetStatus(workerId, status, verified, why));
      if (r && r.ok) {
        // Marking somebody checked queues their ID document for destruction.
        // Doing it here means the file is gone seconds later rather than
        // waiting for whenever an admin next happens to open this screen.
        api.flushDeletions().catch(() => {});
        if (onChanged) onChanged();
        onClose();
        return;
      }
      // Not called "why": that is the parameter passed to adminSetStatus
      // above, and a const of the same name in this block shadowed it --
      // every call threw "Cannot access 'why' before initialization".
      const reason = (r && r.reason) || "";
      // 67 answers 'missing:vehicle_number,id_doc' rather than just failing,
      // so the admin is told WHICH thing is absent instead of hunting.
      if (reason.startsWith("missing:")) {
        const names = reason.slice(8).split(",").map((k) =>
          k === "vehicle_number" ? t("w3_vehicle") : t("adm_id_title")
        );
        setErr(`${t("adm_blocked")} ${names.join(", ")}`);
      } else {
        setErr(reason || t("e_save"));
      }
    } catch (e) { setErr(e.message || t("e_save")); }
    finally { setBusy(false); }
  };

  const Field = ({ label, children }) => (
    <div style={{ display: "flex", gap: 10, padding: "9px 0",
                  borderBottom: `1px solid ${T.line}` }}>
      <span style={{ flex: "0 0 40%", fontSize: 12.5, color: T.inkFaint, fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ flex: 1, fontSize: 13.5, color: T.ink, minWidth: 0,
                     wordBreak: "break-word" }}>
        {children === null || children === undefined || children === ""
          ? <span style={{ color: T.inkFaint }}>—</span> : children}
      </span>
    </div>
  );

  return (
    <div role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 320, background: "rgba(15,20,25,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}>
      <div style={{
        background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 560,
        padding: "18px 18px 24px", maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 -10px 40px rgba(0,30,45,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: T.ink, flex: 1 }}>
            {d ? d.full_name : t("adm_review")}
          </span>
          <CloseButton onClick={onClose} />
        </div>

        {failed && <Notice tone="bad">{t("e_save")}</Notice>}
        {!d && !failed && (
          <div style={{ fontSize: 14, color: T.inkFaint }}>{t("wal_loading")}</div>
        )}

        {d && (
          <>
            {err && <Notice tone="bad">{err}</Notice>}

            {/* What is stopping publication, first and in red. */}
            {(d.gaps || []).length > 0 && (
              <Notice tone="bad">
                {t("adm_blocked")}{" "}
                {(d.gaps || []).map((g) =>
                  g === "vehicle_number" ? t("w3_vehicle") : t("adm_id_title")).join(", ")}
              </Notice>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "14px 0" }}>
              {d.avatar_url ? (
                <img src={d.avatar_url} alt="" style={{
                  width: 64, height: 64, borderRadius: "50%", objectFit: "cover",
                  border: `1px solid ${T.line}`,
                }} />
              ) : (
                <span style={{
                  width: 64, height: 64, borderRadius: "50%", background: T.paper,
                  border: `1px dashed ${T.line}`, color: T.inkFaint,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Icon name="user" size={26} /></span>
              )}
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.brandDark }}>
                  {d.trade_name} · {d.group_name}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkFaint, marginTop: 3 }}>
                  {d.status} · {d.verified ? t("adm_checked") : t("adm_unchecked")}
                  {d.source === "admin" ? " · added by you" : " · self-listed"}
                </span>
              </span>
            </div>

            <Field label={t("adm_f_phone")}>{d.phone}</Field>
            {d.business_name && <Field label={t("w2_shop")}>{d.business_name}</Field>}
            {d.requires_vehicle && (
              <Field label={t("w3_vehicle")}>
                <span style={{ fontWeight: 800, letterSpacing: 1 }}>{d.vehicle_number}</span>
                {/* An owner and his driver legitimately share a car. Five
                    listings on one plate is a different story, so the number
                    is shown rather than silently enforced. */}
                {Number(d.same_vehicle_count) > 0 && (
                  <span style={{ color: T.red, fontWeight: 700, marginLeft: 8 }}>
                    {t("adm_same_vehicle").replace("{n}", String(d.same_vehicle_count))}
                  </span>
                )}
              </Field>
            )}
            {/* Names, not slugs. An admin reading "t1-1" learns nothing,
                and this is the second time raw slugs have leaked into a
                screen in this project. */}
            <Field label={t("adm_f_other")}>
              {(d.other_trades || [])
                .map((sl) => tradeName(trades.find((x) => x.slug === sl), lang) || sl)
                .join(", ")}
            </Field>
            <Field label={t("adm_f_years")}>{d.years_experience}</Field>
            <Field label={t("adm_f_rate")}>
              {d.day_rate_min || d.day_rate_max
                ? `₹${d.day_rate_min || "?"}–₹${d.day_rate_max || "?"}` : null}
            </Field>
            <Field label={t("adm_f_area")}>
              {[d.locality, d.city, d.state].filter(Boolean).join(", ")}
            </Field>
            <Field label={t("adm_f_addr")}>{d.address_line}</Field>
            <Field label={t("p_landmark")}>{d.landmark}</Field>
            <Field label={t("p_pincode")}>{d.pincode}</Field>
            <Field label={t("adm_map")}>
              {typeof d.lat === "number" ? (
                <a href={`https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=17/${d.lat}/${d.lng}`}
                   target="_blank" rel="noreferrer"
                   style={{ color: T.brandDark, fontWeight: 700 }}>
                  {d.lat.toFixed(5)}, {d.lng.toFixed(5)} ({d.loc_source})
                </a>
              ) : null}
            </Field>
            <Field label={t("adm_f_about")}>{d.about}</Field>
            <Field label={t("adm_views")}>{String(d.contact_views)}</Field>

            {(d.photos || []).length > 0 && (
              <div style={{ margin: "14px 0" }}>
                <div style={{ fontSize: 12.5, color: T.inkFaint, fontWeight: 700, marginBottom: 7 }}>
                  {t("p_photos")}
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                  {(d.photos || []).map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer">
                      <img src={src} alt="" style={{
                        width: 92, height: 92, objectFit: "cover", borderRadius: 10,
                        border: `1px solid ${T.line}`, flexShrink: 0,
                      }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* The ID. Behind a button on purpose. */}
            <div style={{
              margin: "14px 0", padding: "13px 14px", borderRadius: 12,
              border: `1px solid ${T.line}`, background: T.paper,
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 6 }}>
                {t("adm_id_title")}
              </div>
              {!d.has_id_doc ? (
                <div style={{ fontSize: 13, color: T.inkFaint, lineHeight: 1.6 }}>
                  {d.verified ? t("adm_id_destroyed") : t("adm_id_none")}
                </div>
              ) : idUrl ? (
                <>
                  <img src={idUrl} alt="" style={{
                    width: "100%", borderRadius: 10, border: `1px solid ${T.line}`,
                  }} />
                  <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 8, lineHeight: 1.55 }}>
                    {t("adm_id_note")}
                  </div>
                </>
              ) : (
                <>
                  <Btn kind="ghost" onClick={showId}>{t("adm_id_show")}</Btn>
                  {idErr && <div style={{ fontSize: 12.5, color: T.red, marginTop: 8 }}>
                    {t("adm_id_failed")}
                  </div>}
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              {!d.verified && (
                <Btn kind="dark" disabled={busy} onClick={() => act(d.status, true)}>
                  {t("adm_mark_checked")}
                </Btn>
              )}
              {d.status !== "approved" && (
                <Btn disabled={busy} onClick={() => act("approved", null)}>
                  {t("adm_publish")}
                </Btn>
              )}
              {d.status !== "hidden" && (
                <Btn kind="ghost" style={{ color: T.red }} disabled={busy}
                     onClick={() => { setHideWhy(d.rejection_reason || ""); setHiding(true); }}>
                  {t("adm_hide")}
                </Btn>
              )}
              {/* Last, and separated: Hide is reversible and Delete is not,
                  so Hide should be the one that falls under the thumb. */}
              <Btn kind="ghost" disabled={busy} onClick={() => setConfirmDel(true)}
                   style={{ color: T.red, borderColor: "rgba(196,61,46,0.35)" }}>
                <Icon name="trash" size={16} /> {t("del_confirm")}
              </Btn>
            </div>

            {/* The reason box, opened by Hide. */}
            {hiding && (
              <div style={{
                marginTop: 14, padding: "14px", borderRadius: 12,
                border: `1px solid ${T.line}`, background: T.paper,
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 6 }}>
                  {t("adm_hide_reason")}
                </div>
                <textarea
                  value={hideWhy} onChange={(e) => setHideWhy(e.target.value)}
                  placeholder={t("adm_hide_reason_ph")} autoFocus
                  style={{ ...input, width: "100%", minHeight: 84, resize: "vertical",
                           boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Btn kind="ghost" full disabled={busy}
                       onClick={() => setHiding(false)}>{t("cancel")}</Btn>
                  <Btn full disabled={busy}
                       style={{ background: T.red, border: "none", color: "#fff" }}
                       onClick={() => { setHiding(false); act("hidden", null, hideWhy); }}>
                    {t("adm_hide_confirm")}
                  </Btn>
                </div>
              </div>
            )}

            {/* Removing the PERSON, not the listing. Separated from the row
                of status buttons and below the reason box, because it is a
                different order of decision: the listing buttons all have a
                way back and this one does not. */}
            {d.account_id && (
              <div style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${T.line}`,
                            display: "flex", justifyContent: "center" }}>
                <button onClick={() => setConfirmAcct(true)} disabled={busy} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "none", border: "none", cursor: "pointer",
                  color: T.red, fontSize: 13.5, fontWeight: 700, minHeight: 44,
                  fontFamily: "inherit",
                }}>
                  <Icon name="trash" size={16} /> {t("adm_delete_account")}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {confirmAcct && d && (
        <ConfirmDelete
          title={t("del_acct_title")}
          body={t("del_acct_body")}
          busy={busy}
          onCancel={() => setConfirmAcct(false)}
          onConfirm={async () => {
            setBusy(true); setErr(null);
            try {
              // Deleting never blocks the number: a removed person can make a
              // new account. Blocking left people unable to sign up with
              // no way back except SQL.
              const r = one(await api.adminDeleteAccount(
                d.account_id, hideWhy || null, false));
              if (r && r.ok) {
                api.flushDeletions().catch(() => {});
                if (onChanged) onChanged();
                onClose();
                return;
              }
              setErr(t("del_failed"));
            } catch (_) { setErr(t("del_failed")); }
            finally { setBusy(false); setConfirmAcct(false); }
          }}
        />
      )}

      {confirmDel && (
        <ConfirmDelete
          title={t("del_admin_title")}
          body={t("del_admin_body")}
          busy={busy}
          onCancel={() => setConfirmDel(false)}
          onConfirm={async () => {
            setBusy(true); setErr(null);
            try {
              const r = one(await api.adminDeleteListing(workerId));
              if (r && r.ok) {
                api.flushDeletions().catch(() => {});
                if (onChanged) onChanged();
                onClose();
                return;
              }
              setErr(t("del_failed"));
            } catch (_) { setErr(t("del_failed")); }
            finally { setBusy(false); setConfirmDel(false); }
          }}
        />
      )}
    </div>
  );
}

function UnblockBox({ api }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.adminUnblockPhone(phone));
      setMsg(r && r.ok ? t("unblock_ok") : t("unblock_none"));
      if (r && r.ok) setPhone("");
    } catch (_) {
      setMsg(t("e_save"));
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        display: "inline-flex", alignItems: "center", gap: 7, background: "none",
        border: "none", cursor: "pointer", color: T.inkFaint, fontSize: 13,
        fontWeight: 700, minHeight: 40, fontFamily: "inherit", padding: 0,
        marginBottom: 10,
      }}>
        <Icon name="user" size={15} /> {t("unblock_title")}
      </button>
    );
  }

  return (
    <div style={{
      border: `1px solid ${T.line}`, borderRadius: 12, padding: "13px 14px",
      marginBottom: 14, background: T.paper,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, flex: 1 }}>
          {t("unblock_title")}
        </span>
        <CloseButton onClick={() => { setOpen(false); setMsg(null); }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder={t("unblock_ph")} inputMode="numeric"
          style={{ ...input, flex: 1, minWidth: 0 }}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) go(); }}
        />
        <Btn kind="ghost" disabled={busy || !phone.trim()} onClick={go}>
          {t("unblock_do")}
        </Btn>
      </div>
      {msg && <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 9 }}>{msg}</div>}
    </div>
  );
}

function AdminList({ api, trades, reloadKey }) {
  const [status, setStatus] = useState("pending");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [reviewId, setReviewId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.adminList(status === "all" ? null : status)
      .then((r) => setList(many(r)))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [api, status, reloadKey]);

  useEffect(() => { load(); }, [load]);

  // A sweep on entering Manage, so anything queued by a session that was
  // closed mid-action is cleared by the next admin who shows up.
  useEffect(() => { api.flushDeletions().catch(() => {}); }, [api]);

  const act = async (id, s, v) => {
    setBusyId(id);
    try { await api.adminSetStatus(id, s, v); load(); } finally { setBusyId(null); }
  };

  return (
    <div>
      {/* Unblocking, in the screen rather than in the SQL editor.
          A number barred by a delete had no way back except a hand-written
          DELETE, which is not something an admin should need at 11pm to let
          a person who was removed by mistake sign up again. */}
      <UnblockBox api={api} />

      <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
        {["pending", "approved", "hidden", "all"].map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div style={{ fontSize: 13.5, color: T.inkFaint }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ fontSize: 14, color: T.inkFaint }}>Nothing with that status.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((w) => (
            <div key={w.id} style={{
              background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14,
              display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap",
            }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, display: "flex", gap: 6, alignItems: "center" }}>
                  {w.full_name}
                  {w.verified && <span style={{ color: T.green }}><Icon name="check" size={15} /></span>}
                </div>
                <div style={{ fontSize: 12.5, color: T.brandDark, fontWeight: 700, marginTop: 2 }}>{w.trade_name}</div>
                <div style={{ fontSize: 12.5, color: T.inkFaint, marginTop: 4, lineHeight: 1.5 }}>
                  {[w.phone, w.locality ? `${w.locality}, ${w.city}` : w.city,
                    w.years_experience ? `${w.years_experience} yrs` : null,
                    w.source === "admin" ? "added by you" : "self-listed",
                    Number(w.contact_views) > 0 ? `${w.contact_views} number views` : null,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {/* First, and primary on a pending row: the whole point of
                    67 is that publishing happens after reading the record,
                    not from the six fields that fit in this list. */}
                <Btn kind={w.status === "pending" ? "primary" : "ghost"}
                     style={{ padding: "9px 14px", minHeight: 40, fontSize: 13.5 }}
                     onClick={() => setReviewId(w.id)}>Review</Btn>
                {w.status !== "approved" && (
                  <Btn kind="ghost" style={{ padding: "9px 14px", minHeight: 40, fontSize: 13.5 }}
                       disabled={busyId === w.id} onClick={() => act(w.id, "approved", null)}>Publish</Btn>
                )}
                {!w.verified && (
                  <Btn kind="ghost" style={{ padding: "9px 14px", minHeight: 40, fontSize: 13.5 }}
                       disabled={busyId === w.id} onClick={() => act(w.id, w.status, true)}>Mark checked</Btn>
                )}
                {w.status !== "hidden" && (
                  <Btn kind="ghost" style={{ padding: "9px 14px", minHeight: 40, fontSize: 13.5, color: T.red }}
                       disabled={busyId === w.id} onClick={() => act(w.id, "hidden", null)}>Hide</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewId && (
        <AdminReview api={api} trades={trades} workerId={reviewId}
                     onClose={() => setReviewId(null)} onChanged={load} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------- page
export default function ServicesPage({
  supabaseUrl, anonKey, user = null, getAccessToken = null,
  isAdmin = false, onSignIn, onSignOut, onProfileSaved,
}) {
  const base = useMemo(
    () => makeApi({ supabaseUrl, anonKey, getAccessToken }),
    [supabaseUrl, anonKey, getAccessToken]
  );

  // The two upload helpers differ only in which bucket they write to and in
  // what comes back: a public URL for a work photo, and a PATH for an ID --
  // there is no readable URL for the private bucket, by design.
  const api = useMemo(() => ({
    ...base,
    uploadPublic: async (bucket, file) => {
      const path = await base.upload(bucket, file, user && user.id);
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
    },
    uploadPrivate: (bucket, file) => base.upload(bucket, file, user && user.id),
  }), [base, supabaseUrl, user]);
  const { t, lang } = useI18n();
  const [tab, setTab] = useState("browse");
  const inApp = useMemo(() => isInstalledApp(), []);

  // First visit: a full-screen language choice, once. Anybody who already
  // picked a language (or was here before this screen existed) skips it.
  const [langGate, setLangGate] = useState(() => {
    try {
      return !window.localStorage.getItem("dhundo_lang_chosen") &&
             !window.localStorage.getItem("services_lang");
    } catch (_) { return false; }
  });
  const closeLangGate = () => {
    try { window.localStorage.setItem("dhundo_lang_chosen", "1"); } catch (_) {}
    setLangGate(false);
  };
  const [installOpen, setInstallOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  // null until it has loaded, which is what keeps the header chip from
  // flashing ₹0 first. Paise, as an integer, all the way to rupees().
  const [walletPaise, setWalletPaise] = useState(null);
  const [referredBy, setReferredBy] = useState(null);

  // Taken out of the URL on the very first render, before the address bar is
  // rewritten by anything else. Kept in localStorage until there is an
  // account to attach it to -- somebody can follow a link today and sign up
  // next week.
  useEffect(() => { captureFromUrl(); }, []);

  // WHERE THE PERSON IS
  //
  // Remembered, because somebody in Gurugram should not re-pick Haryana every
  // time they open the app, and detected on the very first visit so the first
  // screen is already about their town -- the Rapido/Uber behaviour. Detection
  // is attempted ONCE and never again: a permission prompt on every load is
  // the fastest way to be dismissed permanently.
  const [place, setPlace] = useState(() => {
    try {
      const raw = window.localStorage.getItem("dhundo_place");
      if (raw) {
        const p = JSON.parse(raw);
        // The coordinates are part of the place, not a detail of one
        // detection. Dropping them on reload meant the app asked for the
        // location permission again on every visit and lost distance
        // sorting until somebody granted it a second time.
        if (p && STATES.includes(p.state)) {
          return {
            area: p.area || "", state: p.state,
            lat: typeof p.lat === "number" ? p.lat : undefined,
            lng: typeof p.lng === "number" ? p.lng : undefined,
          };
        }
      }
      // Migrate the older key rather than losing the choice.
      const old = window.localStorage.getItem("services_state");
      if (old && STATES.includes(old)) return { area: "", state: old };
    } catch (_) {}
    return { area: "", state: DEFAULT_STATE };
  });
  const [outside, setOutside] = useState(null);

  useEffect(() => {
    try { window.localStorage.setItem("dhundo_place", JSON.stringify(place)); } catch (_) {}
  }, [place]);

  const geo = useMyLocation();
  useEffect(() => {
    let done = false;
    try { done = window.localStorage.getItem("dhundo_geo_tried") === "1"; } catch (_) {}
    if (done || !geo.supported) return;
    try { window.localStorage.setItem("dhundo_geo_tried", "1"); } catch (_) {}
    let alive = true;
    geo.detect().then((got) => {
      if (!alive || !got) return;
      if (got.state && !STATES.includes(got.state)) { setOutside(got.state); return; }
      setPlace((p) => ({
        area: got.area || p.area,
        state: got.state && STATES.includes(got.state) ? got.state : p.state,
        lat: got.lat, lng: got.lng,
      }));
    });
    return () => { alive = false; };
    // Once per install, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state = place.state;
  const [trades, setTrades] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.listTrades(false, state).then((r) => setTrades(many(r))).catch(() => setTrades([]));
  }, [api, reloadKey, state]);

  const signedIn = !!(user && user.id);

  // DOES THIS PERSON ALREADY HAVE A LISTING?
  //
  // Asked once per sign-in and again after anything is saved, because it
  // decides whether "List yourself" is shown at all. The database refuses a
  // second listing for the same account; offering a form that cannot succeed
  // is worse than offering nothing, and the person who taps it is usually
  // trying to EDIT -- add a category, change a rate -- which lives in
  // My listing. null means not yet known, and while it is null nothing is
  // hidden: a hidden tab that appears a second later is more confusing than
  // one that quietly goes away.
  const [hasListing, setHasListing] = useState(false);
  useEffect(() => {
    if (!signedIn) { setHasListing(false); return; }
    let alive = true;
    api.myListing()
      .then((r) => { if (alive) setHasListing(!!(one(r) && one(r).id)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [api, signedIn, reloadKey]);

  // ------------------------------------------------------------ two modes
  // Find (a customer looking for help) and Work (a worker taking jobs) --
  // Rapido's customer app and captain app, as one app with a switch. The
  // last mode used is remembered; somebody with a listing who has never
  // chosen starts in Work, because that is why a worker opens the app.
  // Remember the half of the app last used, for next time.
  useEffect(() => {
    if (tab === "work" || tab === "browse") {
      try { window.localStorage.setItem("dhundo_mode", tab === "work" ? "work" : "find"); } catch (_) {}
    }
  }, [tab]);
  const modeChosen = useRef(false);
  useEffect(() => {
    if (!hasListing || isAdmin || modeChosen.current) return;
    modeChosen.current = true;
    let saved = null;
    try { saved = window.localStorage.getItem("dhundo_mode"); } catch (_) {}
    if (saved !== "find" && tab === "browse") setTab("work");
    // Only on first learning that this person has a listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasListing, isAdmin]);

  // The heartbeat runs here, not in the Work screen, so a worker's
  // position keeps going while they look at their listing or wallet.
  const avail = useAvailability(api, signedIn && hasListing && !isAdmin);

  // Attempted on every sign-in, not only on sign-up: the database decides
  // whether a code may be attached, and says no once a person has already
  // been referred or their listing is published. A failure is silent -- a
  // new user does not need to be told something is wrong with a link their
  // friend sent them.
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    redeemPending(api).then((who) => {
      if (!alive || !who) return;
      setReferredBy(typeof who === "string" ? who : true);
      setReloadKey((k) => k + 1);   // a code was accepted; re-read the balance
    });
    return () => { alive = false; };
  }, [api, signedIn]);

  // The balance for the header chip. Signing out clears it rather than
  // leaving the previous person's money on screen.
  useEffect(() => {
    if (!signedIn) { setWalletPaise(null); return; }
    let alive = true;
    api.walletBalance()
      .then((r) => {
        if (!alive) return;
        setWalletPaise(Array.isArray(r) ? Number(r[0] || 0) : Number(r || 0));
      })
      .catch(() => { if (alive) setWalletPaise(null); });
    return () => { alive = false; };
  }, [api, signedIn, reloadKey]);

  return (
    <div style={{
      background: T.paper, minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: T.ink,
      // Room for the bottom bar, so it never covers the last card.
      paddingBottom: "calc(72px + env(safe-area-inset-bottom))",
    }}>
      {langGate && <LanguageGate onDone={closeLangGate} />}
      <Header
        tab={tab}
        setTab={setTab}
        isAdmin={isAdmin}
        place={place}
        onOpenLocation={() => setLocOpen(true)}
      />

      {outside && (
        <OutOfArea state={outside} showing={state} onDismiss={() => setOutside(null)} />
      )}

      {/* Shown once, when a code is accepted. Worth saying out loud: the
          person followed somebody's link and should know it registered,
          otherwise the friend who invited them gets asked "did it work?" */}
      {referredBy && (
        <div style={{ maxWidth: 1000, margin: "14px auto 0", padding: "0 16px" }}>
          <Notice tone="good">
            {typeof referredBy === "string"
              ? t("inv_linked_named").replace("{name}", referredBy)
              : t("inv_linked")}
          </Notice>
        </div>
      )}

      {installOpen && <InstallSheet onClose={() => setInstallOpen(false)} />}
      {walletOpen && signedIn && (
        <WalletSheet api={api} phone={user && user.phone}
                     onClose={() => setWalletOpen(false)} />
      )}
      {locOpen && (
        <LocationSheet
          place={place}
          onChange={(p) => { setPlace(p); setOutside(null); }}
          onClose={() => setLocOpen(false)}
        />
      )}

      {tab === "browse" && (
        <Browse
          api={api} trades={trades} user={user} isAdmin={isAdmin}
          onSignIn={onSignIn}
          // Somebody who already listed and taps "List yourself" in the empty
          // state means "let me deal with my listing", so send them there.
          onAdd={() => setTab(hasListing && !isAdmin ? "mine" : "add")}
          place={place} setPlace={setPlace}
          onInstall={() => setInstallOpen(true)}
        />
      )}

      {tab === "work" && (
        <WorkerHome
          avail={avail} signedIn={signedIn} hasListing={hasListing}
          onSignIn={onSignIn}
          onList={() => setTab("add")}
          onOpenListing={() => setTab("mine")}
        />
      )}

      {tab === "mine" && signedIn && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 16px 60px" }}>
          <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 18px" }}>{t("nav_mine")}</h1>
          <MyListing api={api} trades={trades} isAdmin={isAdmin}
                     onGoAdd={() => setTab("add")} />
        </div>
      )}

      {tab !== "browse" && tab !== "mine" && tab !== "work" && tab !== "account" && tab !== "profile" && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "26px 16px 60px" }}>
          {tab === "add" && (
            <>
              <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 6px" }}>
                {isAdmin ? t("add_title_admin") : t("add_title")}
              </h1>
              <p style={{ fontSize: 14.5, color: T.inkSoft, margin: "0 0 20px", lineHeight: 1.6, maxWidth: 520 }}>
                {isAdmin ? t("add_sub_admin") : t("add_sub")}
              </p>
              {!signedIn ? (
                <>
                  <Notice tone="info">{t("need_signin")}</Notice>
                  <Btn onClick={onSignIn}>{t("nav_signin")}</Btn>
                </>
              ) : hasListing && !isAdmin ? (
                // Reachable only by a stale link or the back button now that
                // the tab is hidden, but it must not show a form the database
                // will reject.
                <>
                  <Notice tone="info">{t("p_already_listed")}</Notice>
                  <Btn onClick={() => setTab("mine")}>{t("nav_mine")}</Btn>
                </>
              ) : (
                <ListingForm api={api} trades={trades} user={user} isAdmin={isAdmin}
                             place={place} setPlace={setPlace}
                             onBack={() => setTab(isAdmin ? "browse" : "work")}
                             onDone={() => setReloadKey((k) => k + 1)} />
              )}
            </>
          )}

          {tab === "manage" && isAdmin && (
            <>
              <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 18px" }}>{t("manage_title")}</h1>
              <AdminList api={api} trades={trades} reloadKey={reloadKey} />
            </>
          )}
        </div>
      )}

      {tab === "account" && (
        <AccountPage
          account={signedIn ? user : null}
          walletPaise={walletPaise}
          onOpenWallet={() => setWalletOpen(true)}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onInstall={() => setInstallOpen(true)}
          hasListing={hasListing}
          onOpenListing={() => setTab("mine")}
          onList={() => setTab("add")}
          onOpenProfile={() => setTab("profile")}
          showCredits={inApp}
        />
      )}

      {tab === "profile" && signedIn && (
        <ProfilePage api={api} account={user} hasListing={hasListing}
                     onBack={() => setTab("account")}
                     onList={() => setTab(hasListing ? "mine" : "add")}
                     onSaved={(p) => onProfileSaved && onProfileSaved(p)} />
      )}

      {/* The footer is for the website. In the app the bottom bar does its
          job, and the data credit the licences require is on Account. */}
      {!inApp && (
        <SiteFooter setTab={setTab} hasListing={hasListing && !isAdmin}
                    onInstall={() => setInstallOpen(true)} />
      )}

      <BottomNav tab={tab} setTab={setTab} online={avail.online}
                 signedIn={signedIn} hasListing={hasListing} />
    </div>
  );
}
