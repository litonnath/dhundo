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
  ListingCard, EmptyState, TrustBar, InstallSheet, OutOfArea,
  groupStyle, groupLabel, WalletSheet,
  plateLooksRight, ReqTag, CloseButton, useDismissable, ConfirmDelete, SiteFooter, LiveDot,
  BottomNav, AccountPage, ProfilePage, InstallBanner, SignupHelp, LanguageGate, PopularTrades, matchTrade, matchTrades,
} from "./ui.jsx";
import { snapToKnown, placeCoords, nearestPlaces, bestNearName, pinForPlace, placeIsCoherent, roadDistances, lineDistances } from "./regions.js";
import { hasIndic, variants } from "./translit.js";
import { captureFromUrl, redeemPending } from "./referral.js";
import { MarketPage, ItemDetail, SellPage, AdminAds, shrink } from "./market.jsx";
import { useMyLocation, isInstalledApp, locErrorKey } from "./device.jsx";
import MyListing from "./profile.jsx";
import { useAvailability, WorkerHome } from "./worker.jsx";
import { useI18n, tNow, tradeName, STATES, DEFAULT_STATE, stateName } from "./i18n.jsx";
import { plateExample } from "./states.js";
import { PrivacyLinks } from "./privacy.jsx";
import { PhoneVerifySheet, AdminMfaCard } from "./verify.jsx";
import { TileArt } from "./scenes.jsx";
import { RideScreen, RideRequests, RideTools } from "./ride.jsx";
import { StoreHome, OwnerFood } from "./food.jsx";
import { RatesCard } from "./rates.jsx";
import { useInbox, ChatsPage, ChatScreen, NotificationsSheet } from "./chats.jsx";
import { MenuSheet } from "./menu.jsx";
import { OfferTypeGate, CustomerLauncher, SubCategories, HomeButton, SignInGate, driverKind } from "./start.jsx";
import { AlertsCard } from "./alerts.jsx";
import { OrdersPage } from "./orders.jsx";
import { alertNewJob, RiderJobs, ShopJobs, BookingSheet, MyRequestsSheet, PartnerSheet } from "./hub.jsx";
import { LocationSheet, LocationBar, PlaceField, describePoint, workPlace } from "./locpicker.jsx";
import { useConsent, CONSENT_EVENT } from "./consent-core.js";

// ---------------------------------------------------------------- data layer
// How far "near" is for people available right now, and how far to look
// when nobody is that near.
// Dhundo is for eating, not for lodging: these are never offered or listed.
const STAY_TRADES = ["hotel-lodge", "homestay-guesthouse"];
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
      const msg = data && (data.message || data.error);
      // Two answers the database gives on purpose, said in the person's own
      // language: too many tries, or no consent on record for what was sent.
      if (res.status === 429 || msg === "rate_limited") {
        const e = new Error(tNow("rl_msg")); e.code = "rate_limited"; throw e;
      }
      if (msg === "consent_required") {
        const e = new Error(tNow("cs_server")); e.code = "consent_required"; e.purpose = data && data.hint; throw e;
      }
      throw new Error(msg || `Request failed (${res.status})`);
    }
    return data;
  }

  // The real address of each listing is held with the account (and on the
  // listing); the search cards do not carry it, so it is fetched for the
  // people on screen and put on the card. Asked once per person.
  const addrCache = new Map();
  const withAddr = async (pending) => {
    const res = await pending;
    if (!Array.isArray(res)) return res;
    const need = res.map((r) => r && r.id).filter((id) => id && !addrCache.has(id));
    if (need.length) {
      try {
        const got = await rpc("services_work_addresses", { p_ids: [...new Set(need)].slice(0, 100) });
        const seen = new Set();
        (Array.isArray(got) ? got : []).forEach((g) => { addrCache.set(g.id, g.address || ""); seen.add(g.id); });
        need.forEach((id) => { if (!seen.has(id)) addrCache.set(id, ""); });
      } catch (_) { /* cards keep their area name */ }
    }
    return res.map((r) => (r && r.id && !r.address_line && addrCache.get(r.id) ? { ...r, address_line: addrCache.get(r.id) } : r));
  };

  return {
    listTrades: (onlyWithListings = false, state = null) =>
      rpc("services_list_trades", { p_only_with_listings: onlyWithListings, p_state: state }),
    browse: (o = {}) =>
      withAddr(rpc("services_browse_workers", {
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
      })),
    // No viewer id: 59 reads it from the signed token. Passing one was how
    // a caller could spend somebody else's hourly reveal budget.
    reveal: (workerId) => rpc("services_reveal_contact", { p_worker_id: workerId }, true),
    // Where a shop is, for Directions -- only when its owner chose to show
    // the address and pinned the exact spot. See sql/98.
    directions: (workerId) => rpc("services_worker_directions", { p_worker_id: workerId }, true),

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
      withAddr(rpc("services_available_workers", {
        p_lat: typeof o.lat === "number" ? o.lat : null,
        p_lng: typeof o.lng === "number" ? o.lng : null,
        p_state: o.state || null, p_trade: o.trade || null, p_group: o.group || null,
        p_radius_km: o.radiusKm || NEAR_KM, p_limit: o.limit || 20,
      })),
    // ------------------------------------------------------ Buy & Sell (84)
    itemsBrowse: (o = {}) =>
      rpc("services_items_browse", {
        p_lat: typeof o.lat === "number" ? o.lat : null,
        p_lng: typeof o.lng === "number" ? o.lng : null,
        p_state: o.state || null, p_category: o.category || null, p_q: o.q || null,
        p_min: o.min ?? null, p_max: o.max ?? null, p_radius_km: o.radiusKm || null,
        p_sort: o.sort || "near", p_limit: o.limit || 30, p_offset: o.offset || 0,
      }, true),
    itemBuy: (id, mode, offer, note) => rpc("services_item_buy", { p_item: id, p_mode: mode, p_offer_rupees: offer, p_note: note || null }, true),
    itemOrderUpdate: (id, action, fee) => rpc("services_item_order_update", { p_order: id, p_action: action, p_fee_rupees: fee == null ? null : fee }, true),
    itemOrderComplete: (id, code) => rpc("services_item_order_complete", { p_order: id, p_code: code }, true),
    myItemOrders: () => rpc("services_my_item_orders", {}, true),
    itemChatList: (id) => rpc("services_item_chat_list", { p_order: id }, true),
    itemChatSend: (id, body) => rpc("services_item_chat_send", { p_order: id, p_body: body }, true),
    itemGet: (id) => rpc("services_item_get", { p_id: id }, true),
    itemSave: (p) =>
      rpc("services_item_save", {
        p_id: p.id || null, p_title: p.title, p_description: p.description || null,
        p_category: p.category, p_price: p.price, p_negotiable: p.negotiable,
        p_condition: p.condition, p_brand: p.brand || null, p_model_year: p.model_year,
        p_km_driven: p.km_driven, p_photos: p.photos, p_state: p.state, p_city: p.city,
        p_locality: p.locality, p_lat: p.lat, p_lng: p.lng, p_whatsapp: p.whatsapp,
      }, true),
    itemSetStatus: (id, action) => rpc("services_item_set_status", { p_id: id, p_action: action }, true),
    myItems: () => rpc("services_my_items", {}, true),
    itemReveal: (id) => rpc("services_item_reveal", { p_id: id }, true),
    itemReport: (id, reason, note) =>
      rpc("services_item_report", { p_id: id, p_reason: reason, p_note: note || null }, true),
    adminWithdrawals: (status) => rpc("services_admin_withdrawals", { p_status: status || null }, true),
    adminWithdrawalSet: (id, status, note) =>
      rpc("services_admin_withdrawal_set", { p_id: id, p_status: status, p_note: note || null }, true),
    adminItems: (filter) => rpc("services_admin_items", { p_filter: filter || "reported", p_limit: 100 }, true),
    adminItemAction: (id, action) => rpc("services_admin_item_action", { p_id: id, p_action: action }, true),
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
    myListingPoint: () => rpc("services_my_listing_point", {}, true),
    // An exact position for the listing: "device" for the phone GPS, "picked"
    // for a place chosen or a pin placed by hand (no GPS consent needed).
    setMyPosition: (lat, lng, source) =>
      rpc("services_set_my_position", { p_lat: lat, p_lng: lng, p_source: source || "picked" }, true),
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
    // Everybody in one PIN code, as the same cards the search returns (89).
    pinWorkers: (o = {}) =>
      withAddr(rpc("services_pin_workers", {
        p_pin: o.pin, p_trade: o.trade || null, p_group: o.group || null,
        p_lat: typeof o.lat === "number" ? o.lat : null,
        p_lng: typeof o.lng === "number" ? o.lng : null, p_limit: 50,
      })),
    walletBalance: () => rpc("services_wallet_balance", {}, true),
    myReferrals: () => rpc("services_my_referrals", {}, true),
    applyReferral: (code) => rpc("services_apply_referral", { p_code: code }, true),
    setHome: (lat, lng, exact) =>
      rpc("services_set_home", { p_lat: lat ?? null, p_lng: lng ?? null, p_exact: !!exact }, true),
    exactPositions: (ids) =>
      rpc("services_exact_positions", { p_ids: ids }, false),
    myData: () => rpc("services_my_data", {}, true),
    setNominee: (name, phone) => rpc("services_set_nominee", { p_name: name, p_phone: phone }, true),
    privacyRequest: (kind, body) => rpc("services_privacy_request", { p_kind: kind, p_body: body }, true),
    logAdminAccess: (id, what) => rpc("services_log_admin_access", { p_worker_id: id, p_what: what }, true).catch(() => null),
    // CHECKING THE PHONE (sql/109). GoTrue sends the SMS (phone_change) and
    // checks the code; the database then sees phone_confirmed_at.
    jobPost: (note, drop, fee) => rpc("services_job_post", { p_note: note, p_drop: drop, p_fee_rupees: fee }, true),
    jobsNearby: () => rpc("services_jobs_nearby", {}, true),
    jobCode: (id) => rpc("services_job_code", { p_job: id }, true),
    jobDeliveryCode: (id) => rpc("services_job_delivery_code", { p_job: id }, true),
    jobDeliver: (id, code) => rpc("services_job_deliver", { p_job: id, p_code: code }, true),
    jobVerify: (id, code) => rpc("services_job_verify", { p_job: id, p_code: code }, true),
    jobChatList: (id) => rpc("services_job_chat_list", { p_job: id }, true),
    jobChatSend: (id, body) => rpc("services_job_chat_send", { p_job: id, p_body: body }, true),
    jobAccept: (id) => rpc("services_job_accept", { p_job: id }, true),
    jobUpdate: (id, action) => rpc("services_job_update", { p_job: id, p_action: action }, true),
    myJobs: () => rpc("services_my_jobs", {}, true),
    rideRequest: (pick, drop, vehicle, fare) => rpc("services_ride_request", {
      p_pick_text: pick.text, p_pick_lat: pick.lat, p_pick_lng: pick.lng,
      p_drop_text: drop.text, p_drop_lat: typeof drop.lat === "number" ? drop.lat : null,
      p_drop_lng: typeof drop.lng === "number" ? drop.lng : null,
      p_vehicle: vehicle, p_fare_rupees: fare,
    }, true),
    ridesNearby: () => rpc("services_rides_nearby", {}, true),
    rideAccept: (id) => rpc("services_ride_accept", { p_ride: id }, true),
    myRide: () => rpc("services_my_ride", {}, true),
    menuGet: (workerId) => rpc("services_menu_get", { p_worker: workerId }),
    myMenu: () => rpc("services_my_menu", {}, true),
    menuSave: (m) => rpc("services_menu_save", {
      p_id: m.id || null, p_category: m.category || "Menu", p_name: m.name, p_about: m.about || null,
      p_price_rupees: m.price, p_veg: m.veg, p_available: m.available, p_photo: m.photo || null,
      ...(m.bikeOk === undefined ? {} : { p_bike_ok: !!m.bikeOk }),
    }, true),
    // Shops or food places within the radius of a person, with the dishes or
    // goods that match what they typed. Nothing outside the radius comes back.
    storesNear: (o) => rpc("services_stores_near", {
      p_kind: o.kind, p_lat: o.lat, p_lng: o.lng, p_trade: o.trade || null,
      p_q: o.q || null, p_radius_km: o.radiusKm || NEAR_KM, p_limit: o.limit || 40,
    }),
    ratesGet: (workerId) => rpc("services_rates_get", { p_worker: workerId }),
    myRates: () => rpc("services_my_rates", {}, true),
    rateSave: (r) => rpc("services_rate_save", { p_id: r.id || null, p_label: r.label, p_unit: r.unit, p_rupees: r.rupees }, true),
    rateDelete: (id) => rpc("services_rate_delete", { p_id: id }, true),
    storeInfos: (ids) => rpc("services_store_infos", { p_ids: ids }),
    myStore: () => rpc("services_my_store", {}, true),
    setStore: (o) => rpc("services_set_store", {
      p_open: o.open || null, p_close: o.close || null, p_mins: o.mins || null, p_auto_rider: o.autoRider,
      p_promo: o.promo || null, p_promo_photo: o.promoPhoto || null,
    }, true),
    fuelPrices: () => rpc("services_fuel_prices", {}),
    driverPricing: (ids) => rpc("services_driver_pricing", { p_ids: ids }),
    myFuel: () => rpc("services_my_fuel", {}, true),
    setFuel: (f) => rpc("services_set_fuel", { p_fuel: f || null }, true),
    myRider: () => rpc("services_my_rider", {}, true),
    setRider: (o) => rpc("services_set_rider", { p_per_km: o.perKm === "" || o.perKm == null ? null : Number(o.perKm), p_rides: !!o.rides, p_delivery: !!o.delivery }, true),
    pushSubscribe: (endpoint, p256dh, auth, lang) => rpc("services_push_subscribe", {
      p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_lang: lang,
    }, true),
    pushUnsubscribe: (endpoint) => rpc("services_push_unsubscribe", { p_endpoint: endpoint }, true),
    menuDelete: (id) => rpc("services_menu_delete", { p_id: id }, true),
    setAccepting: (on) => rpc("services_set_accepting", { p_on: !!on }, true),
    orderPlace: (workerId, lines, mode, address, lat, lng, note) => rpc("services_order_place", {
      p_worker: workerId, p_lines: lines, p_mode: mode, p_address: address || null,
      p_lat: typeof lat === "number" ? lat : null, p_lng: typeof lng === "number" ? lng : null, p_note: note || null,
    }, true),
    myOrders: () => rpc("services_my_orders", {}, true),
    orderSendRider: (id, rupees) => rpc("services_order_send_rider", { p_order: id, p_fee_rupees: rupees }, true),
    orderQuote: (id, rupees) => rpc("services_order_quote", { p_order: id, p_fee_rupees: rupees }, true),
    orderUpdate: (id, action) => rpc("services_order_update", { p_order: id, p_action: action }, true),
    rideUpdate: (id, action) => rpc("services_ride_update", { p_ride: id, p_action: action }, true),
    bookingRequest: (worker, startIso, minutes, note) =>
      rpc("services_booking_request", { p_worker: worker, p_start: startIso, p_minutes: minutes, p_note: note || null }, true),
    bookingAnswer: (id, accept) => rpc("services_booking_answer", { p_id: id, p_accept: !!accept }, true),
    chatDelete: (id) => rpc("services_chat_delete", { p_booking: id }, true),
    rideDriverPos: (id) => rpc("services_ride_driver_position", { p_ride: id }, true),
    publicPositions: (ids) => rpc("services_public_positions", { p_ids: ids }),
    rideHistory: () => rpc("services_ride_history", {}, true),
    rideCode: (id) => rpc("services_ride_code", { p_ride: id }, true),
    rideVerify: (id, code) => rpc("services_ride_verify", { p_ride: id, p_code: code }, true),
    rideChatList: (id) => rpc("services_ride_chat_list", { p_ride: id }, true),
    rideChatSend: (id, body) => rpc("services_ride_chat_send", { p_ride: id, p_body: body }, true),
    driverHomes: (ids) => rpc("services_driver_homes", { p_ids: ids }),
    liveDriverPositions: (ids) => rpc("services_live_driver_positions", { p_ids: ids }),
    chatInbox: () => rpc("services_chat_inbox", {}, true),
    chatMarkRead: (id) => rpc("services_chat_mark_read", { p_booking: id }, true),
    chatOpen: (id) => rpc("services_chat_open", { p_booking: id }, true),
    chatList: (id) => rpc("services_chat_list", { p_booking: id }, true),
    chatSend: (id, body) => rpc("services_chat_send", { p_booking: id, p_body: body }, true),
    bookingCancel: (id) => rpc("services_booking_cancel", { p_id: id }, true),
    myHireRequests: () => rpc("services_my_hire_requests", {}, true),
    myBookings: () => rpc("services_my_bookings", {}, true),
    cfg: { url: supabaseUrl, anonKey },
    accessToken: async () => (getAccessToken ? getAccessToken() : null),
    phoneVerified: () => rpc("services_phone_verified", {}, true),
    claimRewards: () => rpc("services_claim_rewards", {}, true),
    sendPhoneCode: async (phone) => {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: "PUT", headers: await authHeaders(), body: JSON.stringify({ phone }),
        });
        return { ok: res.ok, status: res.status };
      } catch (_) { return { ok: false, status: 0 }; }
    },
    verifyPhoneCode: async (phone, token) => {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/verify`, {
          method: "POST", headers: await authHeaders(),
          body: JSON.stringify({ type: "phone_change", phone, token }),
        });
        return { ok: res.ok, status: res.status };
      } catch (_) { return { ok: false, status: 0 }; }
    },
    withdraw: (upi) => rpc("services_withdraw_request", { p_upi: upi }, true),
    myWithdrawals: () => rpc("services_my_withdrawals", {}, true),
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
// THE SIX WAYS IN: big tiles on the customer home. Each opens the search
// already narrowed to that kind of thing; Buy & Sell opens the ads; Partner is
// shown as coming soon until it exists.
function HomeTiles({ onWorker, onRide, onShop, onEat, onMarket, onPartner }) {
  const { t } = useI18n();
  const tiles = [
    ["construction", t("home_worker"), onWorker, "#FFF1E6", "#B45309"],
    ["drivers", t("home_ride"), onRide, "#E8F1FF", "#1D4ED8"],
    ["suppliers", t("home_shop"), onShop, "#EAF7EE", "#15803D"],
    ["food", t("home_eat"), onEat, "#FFF4D6", "#A16207"],
    ["tag", t("mk_tab"), onMarket, "#F3E8FF", "#7E22CE"],
    ["user", t("home_partner"), onPartner, "#E0F2F1", "#0F766E"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, margin: "0 0 22px" }}>
      {tiles.map(([icon, label, go, bg, fg]) => (
        <button key={icon + label} onClick={go || undefined} disabled={!go} style={{
          display: "flex", alignItems: "center", gap: 12, minHeight: 74, padding: "10px 14px",
          borderRadius: 16, border: `1px solid ${T.line}`, background: T.white, textAlign: "left",
          cursor: go ? "pointer" : "default", fontFamily: "inherit", opacity: go ? 1 : 0.7,
        }}>
          <span style={{
            width: 46, height: 46, borderRadius: 14, background: bg, color: fg, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Icon name={icon} size={24} /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink, lineHeight: 1.25 }}>{label}</span>
            {!go && <span style={{ display: "block", fontSize: 12, color: T.inkFaint, fontWeight: 600 }}>{t("home_soon")}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

// Remembered between visits so Back from Buy something lands on the I need tiles.
let lastSide = null;
function Browse({ api, trades, user, isAdmin, onSignIn, onAdd, place, setPlace, onInstall, onPickLocation, onMarket, onPartner, onBook, onOffer }) {
  const { t, lang } = useI18n();
  const geo = useMyLocation();
  const [group, setGroup] = useState(null);
  // Which front tile this person entered: null shows the six tiles.
  // A shop owner who chose to hire a vehicle for an order lands on the hire screen.
  const [section, setSection] = useState(() => { try { const x = window.localStorage.getItem("dhundo_open_section"); if (x) { window.localStorage.removeItem("dhundo_open_section"); return x; } } catch (_) {} return null; });
  // The very first choice: I need / I offer. Stays on "need" while browsing tiles.
  const [side, setSideState] = useState(lastSide);
  const setSide = (v) => { lastSide = v; setSideState(v); };
  const [trade, setTrade] = useState(null);
  // "Show everyone in this category" instead of picking a sub-category.
  const [allIn, setAllIn] = useState(false);
  const [search, setSearch] = useState("");
  // Read the phone's position (asks first, see consent-core.js) and look
  // from there. Used by the button below and by the card on the home screen.
  const locate = async () => {
    const got = await geo.detect();
    if (!got || typeof got.lat !== "number") return;
    const d = await describePoint({ lat: got.lat, lng: got.lng, state: got.state || place.state,
                                    address: got.address, area: got.area, accuracy: got.accuracy });
    // A position outside the states we cover is left to the "outside" notice
    // in the location sheet rather than saved as a place here.
    if (d.state && !STATES.includes(d.state)) { onPickLocation && onPickLocation(); return; }
    setPlace({ area: d.area || (place && place.area) || "", state: d.state || place.state,
               lat: d.lat, lng: d.lng, pin: d.pin || undefined, city: d.town || undefined,
               address: d.line || undefined, exact: true });
  };
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
  // Shops whose owner shares the exact spot, fetched once the number is opened.
  const [dirs, setDirs] = useState({});
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
  // A word can mean more than one trade -- "paint" is the painter AND the
  // paint shop -- and then all of them are searched and shown together.
  const typedTrades = useMemo(
    () => (!trade && search.trim() ? matchTrades(search, trades) : []),
    [search, trade, trades]);
  const typed = typedTrades.length > 0;
  // The trades to ask for: the one picked, or every one the words mean.
  const tradeSlugs = trade ? [trade] : typed ? typedTrades.map((x) => x.slug) : [null];
  const slugKey = tradeSlugs.join(",");
  // When the customer's position is known, results are sorted by real
  // distance, so the area name must not ALSO filter them: with it, somebody
  // in Dharmanagar never saw a shop listed under Tilthai, 8 km away.
  const hasPos = typeof (place && place.lat) === "number";
  const byDistance = (a, b) =>
    (a.distance_km == null ? 1e9 : Number(a.distance_km)) - (b.distance_km == null ? 1e9 : Number(b.distance_km));
  // 0 means any distance (up to FAR_KM).
  const [radius, setRadiusState] = useState(() => {
    try { return Number(window.localStorage.getItem("dhundo_radius")) || 0; } catch (_) { return 0; }
  });
  const setRadius = (km) => {
    setRadiusState(km);
    try { window.localStorage.setItem("dhundo_radius", String(km)); } catch (_) {}
  };

  const load = useCallback(() => {
    if (showGrid) { setList([]); setTotal(0); return; }
    setLoading(true);
    setError(null);
    // A name or place typed in any Indian script is searched under each
    // likely English spelling ("সুকান্ত" -> sukant, sukanta), because
    // that is how listings are stored; the results are merged.
    const text = typed ? null : search;
    const spellings = text && hasIndic(text) ? variants(text, 4) : [text];
    // With a position: one search, sorted by distance, the town and every
    // village around it alike. Without one: the area first, then everybody
    // else in the state -- a shop in the next village is never hidden just
    // because its listing names the village and not the town.
    const areas = hasPos || !locality ? [null] : [locality, null];
    const asks = tradeSlugs.flatMap((slug) =>
      spellings.flatMap((sp) => areas.map((area) => [slug, sp, area])));
    const ask = ([slug, sp, area], withPos) =>
      api.browse({ trade: slug,
                   group: typed ? null : group,
                   search: sp, locality: area, state,
                   lat: withPos ? place.lat : null, lng: withPos ? place.lng : null,
                   // Said outright rather than left to the database default:
                   // everyone within 100 km, nearest first.
                   radiusKm: withPos ? (radius || FAR_KM) : null })
        .then(many).catch(() => []);
    Promise.all(asks.map((a) => ask(a, hasPos)))
      // Nothing within reach of the position -- a place picked with a rough
      // position, or a listing not yet placed well -- is no reason to show
      // nothing: fall back to the whole state, by name.
      .then((sets) => (hasPos && sets.every((x) => !x.length)
        ? Promise.all(asks.map((a) => ask(a, false)))
        : sets))
      .then((sets) => {
        const seen = new Set();
        const rowsOut = [];
        sets.forEach((set) => set.forEach((row) => {
          if (!seen.has(row.id)) { seen.add(row.id); rowsOut.push(row); }
        }));
        if (asks.length > 1 && hasPos) rowsOut.sort(byDistance);
        setList(rowsOut);
        setTotal(asks.length > 1 ? rowsOut.length
                 : rowsOut.length ? Number(rowsOut[0].total_count) : 0);
      })
      .catch((e) => setError(e.message || t("e_load")))
      .finally(() => setLoading(false));
  }, [api, trade, group, search, slugKey, typed, locality, state, showGrid, hasPos, radius,
      place && place.lat, place && place.lng]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const slugs = showGrid ? [null] : tradeSlugs;
    const fetchLive = () =>
      Promise.all(slugs.map((slug) => api.availableWorkers({
        lat: place && place.lat, lng: place && place.lng, state,
        trade: slug,
        group: showGrid || typed ? null : group,
        limit: showGrid ? 8 : 20,
        radiusKm: FAR_KM,
      }).then(many)))
        .then((sets) => {
          if (!alive) return;
          const seen = new Set();
          let rows = [];
          sets.forEach((set) => set.forEach((x) => { if (!seen.has(x.id)) { seen.add(x.id); rows.push(x); } }));
          if (slugs.length > 1) rows.sort(byDistance);
          // A typed search narrows the live list the same way it narrows
          // the ordinary one, by name, trade or area.
          const q = typed ? "" : search.trim();
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
  }, [api, state, trade, group, showGrid, search, slugKey, typed, place && place.lat, place && place.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Available first, then everybody else once; the live copy of a card wins
  // because its distance is from where the worker is now.
  const liveIds = useMemo(() => new Set(live.map((r) => r.id)), [live]);

  // SAME PIN CODE FIRST. Everybody whose listing is in the customer's PIN
  // code, shown above everyone else whatever the distance says: a PIN is
  // something both sides know, where a village position can be rough.
  const pin = place && place.pin;
  const [pinRows, setPinRows] = useState([]);
  useEffect(() => {
    if (!pin || showGrid) { setPinRows([]); return; }
    let alive = true;
    Promise.all(tradeSlugs.map((slug) => api.pinWorkers({
      pin, trade: slug, group: typed ? null : group,
      lat: place && place.lat, lng: place && place.lng,
    }).then(many).catch(() => [])))
      .then((sets) => {
        if (!alive) return;
        const seen = new Set();
        let rows = [];
        sets.forEach((set) => set.forEach((x) => { if (!seen.has(x.id)) { seen.add(x.id); rows.push(x); } }));
        const q = typed ? "" : search.trim();
        if (q) {
          const qs = variants(q, 8).map((v) => v.toLowerCase());
          rows = rows.filter((x) => [x.display_name, x.trade_name, x.locality, x.city]
            .some((v) => qs.some((w) => String(v || "").toLowerCase().includes(w))));
        }
        setPinRows(rows.sort(byDistance));
      });
    return () => { alive = false; };
  }, [api, pin, showGrid, slugKey, typed, group, search, place && place.lat, place && place.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // HOW FAR TO LOOK, chosen by the person and remembered. Only means
  // anything once the app knows where they are.
  const inRadius = (r) => !radius || !hasPos || r.distance_km == null || Number(r.distance_km) <= radius;
  const pinIds = new Set(pinRows.map((r) => r.id));
  const pinShown = onlyLive
    ? live.filter((r) => pinIds.has(r.id))
    : pinRows.map((r) => live.find((l) => l.id === r.id) || r);
  const shown = (onlyLive ? live : [...live, ...list.filter((r) => !liveIds.has(r.id))])
    .filter((r) => !pinIds.has(r.id) && inRadius(r));

  // Which of these listings have an exact position: the rest show an
  // approximate distance, and the card says so.
  const [exactSet, setExactSet] = useState(null);
  const askedExact = useRef(new Set());
  useEffect(() => {
    const ids = [...new Set([...live, ...list, ...pinRows].map((r) => r.id))]
      .filter((id) => id && !askedExact.current.has(id)).slice(0, 150);
    if (!ids.length) return;
    ids.forEach((id) => askedExact.current.add(id));
    api.exactPositions(ids).then((r) => {
      const got = new Set((Array.isArray(r) ? r : []).map((x) => x.id));
      setExactSet((prev) => new Set([...(prev || []), ...got]));
    }).catch(() => { ids.forEach((id) => askedExact.current.delete(id)); });
  }, [live, list, pinRows, api]);
  const posExactOf = (row) => (exactSet === null ? undefined : exactSet.has(row.id));

  // Straight-line distance for listings the search could not measure.
  const [line, setLine] = useState({});
  useEffect(() => {
    if (!place || typeof place.lat !== "number") return;
    const missing = [...live, ...pinRows, ...list]
      .filter((r) => r.id && (r.distance_km === null || r.distance_km === undefined) && line[r.id] === undefined)
      .map((r) => r.id).slice(0, 25);
    if (!missing.length) return;
    let alive = true;
    lineDistances({ lat: place.lat, lng: place.lng }, [...new Set(missing)]).then((r) => {
      if (alive && r) setLine((p) => ({ ...p, ...r }));
    });
    return () => { alive = false; };
  }, [live, list, pinRows, place && place.lat, place && place.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real road distance (Google Routes, through the road-distance function)
  // for the first listings on screen, once the person has a position.
  const [road, setRoad] = useState({});
  const askedRoad = useRef("");
  useEffect(() => {
    if (!place || typeof place.lat !== "number") return;
    const ids = [...live, ...pinRows, ...list].map((r) => r.id).filter(Boolean);
    const first = [...new Set(ids)].slice(0, 25);
    const sig = `${place.lat.toFixed(3)},${place.lng.toFixed(3)}|${first.join(",")}`;
    if (!first.length || askedRoad.current === sig) return;
    askedRoad.current = sig;
    let alive = true;
    roadDistances({ lat: place.lat, lng: place.lng }, first).then((r) => {
      if (alive && r) setRoad((p) => ({ ...p, ...r.km }));
    });
    return () => { alive = false; };
  }, [live, list, pinRows, place && place.lat, place && place.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same PIN code or same town: said in words instead of a distance. Inside
  // one town the positions are often rough, and "18 km" from Panisagar to
  // Panisagar is wrong. Someone available NOW keeps their live distance --
  // that one is from where they actually are.
  const eq = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  const nearLabelFor = (row) => {
    if (row.available_now) return null;
    if (pinIds.has(row.id)) return t("same_pin_badge");
    const myTown = place && place.city;
    const myArea = place && place.area;
    if (eq(row.city, myTown) || eq(row.city, myArea) || eq(row.locality, myArea)) return t("same_town_badge");
    return null;
  };

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
        api.directions(row.id).then((d) => {
          const x = one(d);
          if (x && x.ok && typeof x.lat === "number") setDirs((p) => ({ ...p, [row.id]: { lat: x.lat, lng: x.lng } }));
        }).catch(() => {});
        // One tap should be a call. The number stays on the card too, with
        // WhatsApp beside it, for anybody who would rather message.
        try { window.location.href = `tel:${String(r.phone).replace(/\s/g, "")}`; } catch (_) {}
      }
      else setNote(
        r && r.reason === "phone_not_verified"
          ? t("pv_banner")
          : r && r.reason === "rate_limited"
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

  const pickTile = (k) => {
    if (k === "market") { onMarket && onMarket(); return; }
    if (k === "partner") { onPartner && onPartner(); return; }
    setSection(k);
  };
  const goHome = () => { setSection(null); setGroup(null); setTrade(null); setAllIn(false); setSearch(""); };
  // The front: just the tiles. Coming back to "all categories" from any
  // section other than workers lands here too.
  if (showGrid && section !== "worker" && section !== "ride" && section !== "shop" && section !== "eat") {
    return <CustomerLauncher onPick={pickTile} onOffer={onOffer} side={side} setSide={setSide} />;
  }
  // Worker or Helper: people who come and work. Not drivers (Ride), not
  // shops or suppliers, not food places or stays.
  const notWorker = ["Drivers", "Suppliers", "Eat & Stay"];
  const workerTrades = trades.filter((x) => x.kind !== "supplier" && !notWorker.includes(x.group_name));
  const workerSlugs = new Set(workerTrades.map((x) => x.slug));
  const workerGroups = groups.filter((g) => workerTrades.some((x) => x.group_name === g));
  const liveWorkers = live.filter((x) => workerSlugs.has(x.trade_slug));
  const SECTION = {
    worker: ["home_worker", "construction", "#C2410C", "#FFF1E6"],
    ride: ["home_ride", "drivers", "#1D4ED8", "#E8F0FE"],
    shop: ["home_shop", "suppliers", "#15803D", "#E7F5EC"],
    eat: ["home_eat", "food", "#A16207", "#FDF3DC"],
  }[section] || ["home_worker", "construction", "#C2410C", "#FFF1E6"];
  const groupTrades = section === "worker" ? inGroup.filter((x) => workerSlugs.has(x.slug)) : inGroup;
  const showTiles = !!group && !trade && !allIn && !search.trim() && groupTrades.length > 0;
  if (section === "shop" || section === "eat") {
    const renderEmpty = (row) => (
      <ListingCard
        row={row}
        rate={rateLabel(row.day_rate_min, row.day_rate_max, t("per_day"))}
        tradeLabel={tradeName(trades.find((x) => x.slug === row.trade_slug), lang) || row.trade_name}
        trade={trades.find((x) => x.slug === row.trade_slug)}
        canCall={!!(user && user.id)}
        revealing={revealing === row.id}
        revealed={revealed[row.id]}
        directions={dirs[row.id]} origin={place}
        posExact={posExactOf(row)} roadKm={road[row.id]} lineKm={line[row.id]} onBook={onBook}
        onCall={handleCall}
        otherLabels={tradeLabels}
      />
    );
    return (
      <>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "10px 16px 0" }}>
          <button onClick={goHome} style={{
            display: "inline-flex", alignItems: "center", gap: 6, background: T.white, border: `1px solid ${T.line}`,
            borderRadius: 20, padding: "7px 14px", minHeight: 40, cursor: "pointer", fontFamily: "inherit",
            fontSize: 14, fontWeight: 700, color: T.brandDark,
          }}><Icon name="back" size={16} /> {t("launch_back")}</button>
        </div>
        <StoreHome kind={section} api={api} trades={trades} place={place} user={user} onSignIn={onSignIn}
                   onHire={() => { try { window.localStorage.setItem("dhundo_ride_mode", "hire"); } catch (_) {} setSection("ride"); }} />
      </>
    );
  }
  if (section === "ride" && !group && !trade) {
    return (
      <>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "10px 16px 0" }}>
          <button onClick={goHome} style={{
            display: "inline-flex", alignItems: "center", gap: 6, background: T.white, border: `1px solid ${T.line}`,
            borderRadius: 20, padding: "7px 14px", minHeight: 40, cursor: "pointer", fontFamily: "inherit",
            fontSize: 14, fontWeight: 700, color: T.brandDark,
          }}><Icon name="back" size={16} /> {t("launch_back")}</button>
        </div>
        <RideScreen api={api} trades={trades} signedIn={!!(user && user.id)} place={place} onSignIn={onSignIn}
                    onBrowse={() => setGroup("Drivers")} />
      </>
    );
  }

  return (
    <>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "10px 16px 0", position: "relative", zIndex: 5 }}>
        <button onClick={goHome} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: T.white, border: `1px solid ${T.line}`,
          borderRadius: 20, padding: "7px 14px", minHeight: 40, cursor: "pointer", fontFamily: "inherit",
          fontSize: 14, fontWeight: 700, color: T.brandDark,
        }}><Icon name="back" size={16} /> {t("launch_back")}</button>
      </div>
      <Hero search={search} setSearch={setSearch} compact={!showGrid} tone="worker" onVoice={(said) => {
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
            <TileArt k="worker" style={{ borderRadius: 14, aspectRatio: "21 / 8", maxHeight: 190, marginBottom: 14 }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "0 0 4px" }}>{t(SECTION[0])}</h2>
            <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 14px" }}>{t("what_need")}</p>
            <CategoryGrid groups={workerGroups} counts={counts} onPick={(g) => { setAllIn(false); setGroup(g); }} />
            {liveWorkers.length > 0 && (
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
                  {liveWorkers.slice(0, 5).map((row) => (
                    <ListingCard
                      key={row.id}
                      row={row}
                      rate={rateLabel(row.day_rate_min, row.day_rate_max, t("per_day"))}
                      tradeLabel={tradeName(trades.find((x) => x.slug === row.trade_slug), lang) || row.trade_name}
                      trade={trades.find((x) => x.slug === row.trade_slug)}
                      canCall={!!(user && user.id)}
                      revealing={revealing === row.id}
                      revealed={revealed[row.id]}
                      directions={dirs[row.id]} origin={place}
                      posExact={posExactOf(row)} roadKm={road[row.id]} lineKm={line[row.id]} onBook={onBook}
                      onCall={handleCall}
                      otherLabels={tradeLabels}
                    />
                  ))}
                </div>
              </div>
            )}

            <TrustBar />
          </>
        ) : (
          <>
            {!showTiles && <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setSearch("");
                  if (trade || allIn) { setTrade(null); setAllIn(false); } else { setGroup(null); }
                }}
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
            </div>}

            {showTiles && (
              <SubCategories art={section}
                title={groupLabel(group, lang)} icon={groupStyle(group).icon} fg={groupStyle(group).fg} bg={groupStyle(group).bg}
                items={groupTrades.map((tr) => ({ key: tr.slug, label: tradeName(tr, lang) }))}
                onPick={(slug) => setTrade(slug)}
                onAll={() => setAllIn(true)} allLabel={t("all")} />
            )}
            {!showTiles && group && inGroup.length > 0 && (
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
            {!showTiles && (<>

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
                  onClick={locate}
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
              {geo.state === "error" && typeof (place && place.lat) !== "number" && (
                <span style={{ flexBasis: "100%", fontSize: 12.5, color: T.red, lineHeight: 1.5 }}>
                  {t(locErrorKey(geo.reason))}
                </span>
              )}
            </div>

            {/* How far to look: the person decides, and it is remembered. */}
            {hasPos && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14,
                            overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, flexShrink: 0 }}>
                  {t("radius_label")}
                </span>
                {[5, 10, 30, 50, 0].map((km) => {
                  const on = radius === km;
                  return (
                    <button key={km} onClick={() => setRadius(km)} aria-pressed={on} style={{
                      flex: "0 0 auto", padding: "7px 12px", borderRadius: 18, minHeight: 36,
                      cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                      fontWeight: on ? 800 : 600, whiteSpace: "nowrap",
                      border: `1.5px solid ${on ? T.brandDark : T.line}`,
                      background: on ? T.brandSoft : T.white, color: on ? T.brandDeep : T.ink,
                    }}>{km ? t("radius_km").replace("{n}", km) : t("radius_any").replace("{n}", FAR_KM)}</button>
                  );
                })}
              </div>
            )}

            {liveFar && live.length > 0 && (
              <Notice tone="info">
                <b>{t("av_far_title").replace("{n}", NEAR_KM)}</b> {t("av_far_note")}
              </Notice>
            )}

            {(() => {
              const card = (row) => (
                <ListingCard
                  key={row.id}
                  row={row}
                  rate={rateLabel(row.day_rate_min, row.day_rate_max, t("per_day"))}
                  tradeLabel={tradeName(trades.find((x) => x.slug === row.trade_slug), lang) || row.trade_name}
                  trade={trades.find((x) => x.slug === row.trade_slug)}
                  canCall={!!(user && user.id)}
                  revealing={revealing === row.id}
                  revealed={revealed[row.id]}
                  directions={dirs[row.id]} origin={place}
                  posExact={posExactOf(row)} roadKm={road[row.id]} lineKm={line[row.id]} onBook={onBook}
                  onCall={handleCall}
                  otherLabels={tradeLabels}
                  nearLabel={nearLabelFor(row)}
                />
              );
              const heading = (text) => (
                <h2 style={{ fontSize: 16.5, fontWeight: 800, color: T.ink, margin: "6px 0 10px",
                             display: "flex", alignItems: "center", gap: 7 }}>{text}</h2>
              );
              return (
                <>
                  {pinShown.length > 0 && (
                    <>
                      {heading(<>{t("pin_title").replace("{pin}", pin)}
                        <span style={{ fontWeight: 600, color: T.inkFaint }}>· {pinShown.length}</span></>)}
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
                        {pinShown.map(card)}
                      </div>
                      {shown.length > 0 && heading(t("pin_rest"))}
                    </>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {shown.map(card)}
                  </div>
                </>
              );
            })()}

            {!loading && shown.length === 0 && pinShown.length === 0 && (
              hasPos && radius && radius < FAR_KM ? (
                <div style={{ textAlign: "center", padding: "24px 12px" }}>
                  <p style={{ fontSize: 15, color: T.inkSoft, margin: "0 0 12px" }}>
                    {t("radius_none").replace("{n}", radius)}
                  </p>
                  <Btn onClick={() => setRadius(0)}>{t("radius_wider")}</Btn>
                </div>
              ) : <EmptyState isAdmin={isAdmin} onAdd={onAdd} />
            )}
            </>)}
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
function StepDots({ step, total = 3 }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <span key={n} style={{
          width: n === step ? 22 : 7, height: 7, borderRadius: 4,
          background: n <= step ? T.brandDark : T.line,
        }} />
      ))}
    </div>
  );
}

function BigField({ label, hint, error, fid, children }) {
  return (
    <div id={fid ? `fld-${fid}` : undefined} style={{
      marginBottom: 18,
      ...(error ? { borderLeft: `3px solid ${T.red}`, paddingLeft: 10 } : {}),
    }}>
      <label style={{
        display: "block", fontSize: 14.5, fontWeight: 700, color: T.ink, marginBottom: 7,
      }}>{label}</label>
      {children}
      {error && (
        <div role="alert" style={{ fontSize: 13.5, color: T.red, fontWeight: 800, marginTop: 6, lineHeight: 1.45 }}>{error}</div>
      )}
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

function ListingForm({ api, trades, user, isAdmin, onDone, onNext, onBack, place, setPlace, startGroup = null, startTrade = null }) {
  const consent = useConsent();
  const { t, lang } = useI18n();
  const geo = useMyLocation();

  const [step, setStep] = useState(1);
  const [group, setGroup] = useState(() => (startTrade && (trades.find((x) => x.slug === startTrade) || {}).group_name) || startGroup);
  // A list, not a single value. A mistri who also tiles was previously
  // choosing which half of his work to advertise at the moment he signed
  // up -- and most people never come back to fix that. The FIRST pick is
  // the main trade; the rest become other_trades.
  const [picked, setPicked] = useState(() => (startTrade && trades.some((x) => x.slug === startTrade) ? [startTrade] : []));
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
  // The listing saved but its exact pin did not: said on the success screen.
  const [posFailed, setPosFailed] = useState(false);
  // Shops and food places list what they sell as part of signing up, not only
  // later from the dashboard. Held here until the listing exists.
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({ name: "", price: "", category: "", veg: true, photo: "" });
  const [itemBusy, setItemBusy] = useState(false);
  const [itemsFailed, setItemsFailed] = useState(0);
  // Where THIS listing is. Its own, not the place somebody is browsing from:
  // choosing a shop's location here must not move the home screen, and the
  // home screen's location must not become a shop's by accident.
  const [lp, setLp] = useState(null);

  const set = (k, v) => { setFieldErr(null); setF((p) => ({ ...p, [k]: v })); };
  // An error belongs next to the field it is about: shown there, the page
  // scrolled to it, and the right step opened first when it is on another.
  const [fieldErr, setFieldErr] = useState(null);
  // The ID photo is taken in the form itself (a cook or a driver cannot be
  // listed without one), uploaded to the private bucket now, and attached to
  // the listing when it is created.
  const [idPath, setIdPath] = useState("");
  const [idBusy, setIdBusy] = useState(false);
  const idInputRef = useRef(null);
  const uploadId = async (file) => {
    if (!file) return;
    // An ID photo is stored: a yes first.
    if (!(await consent.ask("listing"))) return;
    setIdBusy(true); setFieldErr(null);
    try { setIdPath(await api.uploadPrivate("services-ids", file)); }
    catch (e) { bad("id", e && e.message === "too_large" ? t("p_too_large") : t("p_upload_failed")); }
    finally { setIdBusy(false); if (idInputRef.current) idInputRef.current.value = ""; }
  };
  const bad = (key, msg, toStep) => {
    setErr(null);
    setFieldErr({ key, msg });
    if (toStep) setStep(toStep);
    setTimeout(() => {
      const el = document.getElementById(`fld-${key}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const inp = el.querySelector("input,textarea");
        if (inp) { try { inp.focus({ preventScroll: true }); } catch (_) {} }
      }
    }, 60);
  };
  const ferr = (key) => (fieldErr && fieldErr.key === key ? fieldErr.msg : null);

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
  // Each kind of business gets its own wording and its own next step.
  const formKind = (chosen && chosen.group_name === "Eat & Stay") ? "eat"
    : ((chosen && chosen.group_name === "Drivers") || group === "Drivers") ? "ride" : isSupplier ? "shop" : "worker";
  // Asked only of the trades that actually drive. The flag comes from the
  // database (services_trades.requires_vehicle) rather than a group name
  // hardcoded here, so changing which trades need a plate is an UPDATE and
  // not a release. Any of the picked trades needing one is enough.
  const needsVehicle = picked.some((slug) => {
    const x = trades.find((y) => y.slug === slug) || {};
    return !!x.requires_vehicle || x.group_name === "Drivers";
  });
  // Cooks, drivers and domestic help are asked for an ID photo; the flag is
  // the database's (services_trades.requires_id), the group names are the
  // fallback for a trades list that does not carry it yet.
  const needsId = !isAdmin && picked.some((slug) => {
    const x = trades.find((y) => y.slug === slug) || {};
    return x.requires_id === undefined ? ["Drivers", "Home & Domestic"].includes(x.group_name) : !!x.requires_id;
  });
  // Shops and food places are listed under a business name, with no day rate or years of experience.
  const isBiz = isSupplier || formKind === "eat";
  const hasItemsStep = !isAdmin && (formKind === "shop" || formKind === "eat");
  const num = (v) => (String(v).trim() === "" ? null : Number(v));
  const addItem = () => {
    if (draft.name.trim().length < 2 || !(Number(draft.price) >= 1)) return setErr(t("lf_item_need"));
    if (items.length >= 12) return setErr(t("lf_item_max"));
    setErr(null);
    setItems((x) => [...x, { ...draft, name: draft.name.trim(), category: draft.category.trim() }]);
    setDraft((d) => ({ name: "", price: "", category: d.category, veg: d.veg, photo: "" }));
  };
  const pickItemPhoto = async (file) => {
    if (!file) return;
    setItemBusy(true); setErr(null);
    try { setDraft((d) => ({ ...d, photo: "" })); const u = await api.uploadPublic("services-photos", await shrink(file)); setDraft((d) => ({ ...d, photo: u })); }
    catch (_) { setErr(t("mk_e_upload")); }
    setItemBusy(false);
  };

  const groups = useMemo(() => {
    const out = [];
    trades.forEach((x) => { if (!out.includes(x.group_name)) out.push(x.group_name); });
    return out;
  }, [trades]);

  const submit = async () => {
    setErr(null);
    setFieldErr(null);
    if (!picked.length) return bad("category", t("e_category"), 1);
    if (needsVehicle && !plateLooksRight(f.vehicle_number)) return bad("vehicle", t("e_vehicle"), 1);
    if (needsId && !idPath) return bad("id", t("e_id_required"), 1);
    if (!f.full_name.trim()) return bad("name", t("e_name"), 2);
    if (String(f.phone).replace(/\D/g, "").length < 10) return bad("phone", t("e_phone"), 2);
    if (!lp || (!lp.area && typeof lp.lat !== "number")) return bad("place", t("loc_need"), 2);
    if (isBiz && !f.business_name.trim()) return bad("biz", t(formKind === "eat" ? "ea_need_name" : "e_name"), 2);
    if (!isBiz) {
      const lo = Number(f.day_rate_min), hi = Number(f.day_rate_max);
      if (!(lo > 0) || !(hi > 0) || hi < lo) return bad("rate", t("e_rate"), 3);
      if (String(f.years_experience).trim() === "" || !(Number(f.years_experience) >= 0)) return bad("years", t("e_years"), 3);
    }
    if (!f.about.trim()) return bad("about", t("e_about"), 3);
    // A listing is stored and shown to other people: a yes first. (An admin
    // adding one for somebody else is not the owner and is not asked.)
    if (!isAdmin && !(await consent.ask("listing"))) return;

    setBusy(true);
    try {
      const shared = {
        p_full_name: f.full_name.trim(),
        p_phone: f.phone.trim(),
        p_trade_slug: picked[0],
        p_years_experience: num(f.years_experience),
        p_day_rate_min: num(f.day_rate_min),
        p_day_rate_max: num(f.day_rate_max),
        p_locality: workPlace(lp).trim() || null,
        p_city: null,
        p_about: f.about.trim() || null,
        p_languages: [],
        p_photos: [],
        p_business_name: f.business_name.trim() || null,
        p_state: (lp && lp.state) || place.state,
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
      if (r && r.ok && !isAdmin) {
        try {
          await api.updateMyListing({
            // services_self_register takes one trade; the extra ones go in
            // the same follow-up call as the address rather than widening a
            // signature that has already been rewritten twice.
            p_other_trades: picked.length > 1 ? picked.slice(1) : null,
            // A listing's address is public: the line the person typed.
            p_address_line: f.address_line.trim() || null,
            p_address_public: true,
            p_landmark: f.landmark.trim() || null,
            p_pincode: f.pincode.trim() || null,
            p_vehicle_number: f.vehicle_number.trim() || null,
            p_city_id: f.city_id || null,
            p_id_doc_path: idPath || null,
          });
        } catch (_) {
          // The listing itself succeeded. Losing an optional address is not
          // worth showing an error over -- it can be added from My listing.
        }
      }

      // An exact spot (the phone GPS, a pin placed on the map, a shop or
      // road chosen from the search) is saved as the listing's position, so
      // distance is from the door and not from the middle of the village.
      if (r && r.ok && !isAdmin && lp && lp.exact && typeof lp.lat === "number") {
        try { await api.setMyPosition(lp.lat, lp.lng, lp.source); } catch (_) { setPosFailed(true); }
      }

      // The goods typed in the last step. The listing exists now, so each one
      // is saved against it; one failing does not undo the listing.
      if (r && r.ok && hasItemsStep && items.length) {
        let lost = 0;
        for (const it of items) {
          try {
            const q = one(await api.menuSave({ category: it.category, name: it.name, price: Number(it.price), veg: formKind === "eat" ? it.veg : true, available: true, photo: it.photo }));
            if (!(q && q.ok)) lost++;
          } catch (_) { lost++; }
        }
        setItemsFailed(lost);
      }

      if (r && r.ok) {
        setDone(r.reason === "updated" ? "updated" : "created");
        if (onDone) onDone();
      } else {
        const why = r && r.reason;
        if (why === "bad_vehicle") return bad("vehicle", t("e_vehicle"), 1);
        if (why === "phone_taken") return bad("phone", t("e_taken"), 2);
        if (why === "bad_phone") return bad("phone", t("e_badphone"), 2);
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
    setDone(null); setPosFailed(false); setItems([]); setItemsFailed(0); setStep(1); setGroup(null); setErr(null); setPicked([]); setIdPath("");
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
        {itemsFailed > 0 && <div style={{ margin: "0 0 16px" }}><Notice tone="bad">{t("lf_items_failed")}</Notice></div>}
        {posFailed && <div style={{ margin: "0 0 16px" }}><Notice tone="bad">{t("loc_pos_failed")}</Notice></div>}
        {!isAdmin && formKind !== "worker" && onNext && (
          <div style={{ textAlign: "left", background: T.brandSoft, border: `1.5px solid ${T.brandDark}`, borderRadius: 14, padding: "14px 16px", margin: "0 0 14px" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{t("nx_title_" + formKind)}</div>
            <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 10px" }}>{t("nx_sub")}</p>
            <Btn full onClick={onNext}>{t("nx_btn")}</Btn>
          </div>
        )}
        <Btn full kind={!isAdmin && formKind !== "worker" && onNext ? "ghost" : "primary"} onClick={reset}>{t("ok_another")}</Btn>
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
        <StepDots step={step} total={hasItemsStep ? 4 : 3} />
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

          {picked.length > 0 && (needsVehicle || needsId) && (
            <div style={{
              background: T.redSoft, border: `1.5px solid ${T.red}`, borderRadius: 14,
              padding: "14px 15px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: T.red, marginBottom: 8 }}>
                {t("w1_need_title")}
              </div>
              {needsVehicle && (
                <BigField fid="vehicle" error={ferr("vehicle")} label={<>{t("w3_vehicle")}<ReqTag /></>} hint={t("w3_vehicle_hint")}>
                  <input
                    style={{
                      ...bigInput, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700,
                      borderColor: plateLooksRight(f.vehicle_number) ? undefined : T.red,
                    }}
                    value={f.vehicle_number}
                    placeholder={plateExample((place && place.state) || (lp && lp.state))}
                    autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                    onChange={(e) => set("vehicle_number", e.target.value)}
                  />
                  {!plateLooksRight(f.vehicle_number) && (
                    <div style={{ color: T.red, fontSize: 12.5, fontWeight: 800, marginTop: 5 }}>{t("req_missing")}</div>
                  )}
                </BigField>
              )}
              {needsId && (
                <BigField fid="id" error={ferr("id")} label={<>{t("adm_id_title")}<ReqTag /></>}
                          hint={t("p_id_which")}>
                  {idPath ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                                  borderRadius: 11, background: T.brandSoft }}>
                      <span style={{ color: T.brandDark }}><Icon name="check" size={19} /></span>
                      <span style={{ flex: 1, fontSize: 14, color: T.brandDeep, fontWeight: 600 }}>{t("p_id_added")}</span>
                      <button onClick={() => setIdPath("")} style={{
                        background: "none", border: "none", cursor: "pointer", color: T.red,
                        fontWeight: 700, fontSize: 13.5, minHeight: 40, fontFamily: "inherit",
                      }}>{t("p_remove")}</button>
                    </div>
                  ) : (
                    <>
                      <button type="button" disabled={idBusy} onClick={() => idInputRef.current && idInputRef.current.click()} style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                        padding: "13px 14px", borderRadius: 11, minHeight: 52, border: `1.5px dashed ${T.red}`,
                        background: T.white, color: T.brandDark, fontSize: 14.5, fontWeight: 700,
                        cursor: idBusy ? "default" : "pointer", fontFamily: "inherit",
                      }}>{idBusy ? t("p_uploading") : t("p_id_upload")}</button>
                      <input ref={idInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                             onChange={(e) => uploadId(e.target.files && e.target.files[0])} />
                    </>
                  )}
                </BigField>
              )}
            </div>
          )}

          {picked.length > 0 && (
            <Btn full onClick={() => {
              if (needsVehicle && !plateLooksRight(f.vehicle_number)) return bad("vehicle", t("e_vehicle"));
              if (needsId && !idPath) return bad("id", t("e_id_required"));
              setErr(null); setFieldErr(null); setStep(2);
            }}>
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

          <BigField fid="name" error={ferr("name")} label={<>{isBiz ? t("f_owner") : t("w2_name")}<ReqTag /></>}>
            <input style={bigInput} value={f.full_name} autoComplete="name"
                   onChange={(e) => set("full_name", e.target.value)} />
          </BigField>

          {isBiz && (
            <BigField fid="biz" error={ferr("biz")} label={<>{t(formKind === "eat" ? "ea_name" : "w2_shop")}<ReqTag /></>} hint={t(formKind === "eat" ? "ea_name_hint" : "f_shop_hint")}>
              <input style={bigInput} value={f.business_name}
                     onChange={(e) => set("business_name", e.target.value)} />
            </BigField>
          )}

          <BigField fid="phone" error={ferr("phone")} label={<>{t("w2_phone")}<ReqTag /></>} hint={t("w2_phone_hint")}>
            <div style={{ ...bigInput, display: "flex", alignItems: "center", gap: 9, padding: "0 15px" }}>
              <span style={{ fontSize: 16.5, color: T.inkFaint, fontWeight: 600 }}>+91</span>
              <input value={f.phone} type="tel" inputMode="numeric" autoComplete="tel"
                     onChange={(e) => set("phone", e.target.value)}
                     style={{ flex: 1, border: "none", outline: "none", fontSize: 16.5,
                              minWidth: 0, padding: "14px 0", background: "transparent",
                              fontFamily: "inherit", color: T.ink }} />
            </div>
          </BigField>

          {/* ONE QUESTION: where. Type a road, a shop or a village and tap it,
              or use the phone's position, then move the pin to the exact
              door if it is not already there. The state, the PIN code and
              the address all follow from the spot -- none of them is typed. */}
          <BigField fid="place" error={ferr("place")} label={<>{t("w2_area")}<ReqTag /></>}>
            <PlaceField
              value={lp}
              sheetPlace={lp || { state: place.state }}
              onChange={(p) => {
                setLp(p);
                setF((prev) => ({
                  ...prev,
                  pincode: p.pin || prev.pincode, pin_auto: true,
                  // The address line starts from what the map found, only for
                  // an exact spot and only when nothing is written yet.
                  address_line: prev.address_line || (p.exact && p.address ? p.address : ""),
                }));
              }}
            />
          </BigField>

          <Btn full onClick={() => {
            if (!f.full_name.trim()) return bad("name", t("e_name"));
            if (String(f.phone).replace(/\D/g, "").length < 10) return bad("phone", t("e_phone"));
            if (!lp || (!lp.area && typeof lp.lat !== "number")) return bad("place", t("loc_need"));
            setErr(null); setFieldErr(null); setStep(3);
          }}>{t("w_next")}</Btn>
        </>
      )}

      {/* --------------------------------------------------- 3. optional */}
      {step === 3 && (
        <>
          <h2 style={title}>{t("w3_title_req")}</h2>
          {/* "All optional" stops being true the moment a driver is on this
              step, and a promise the form then breaks is worse than no
              promise at all. */}
          <p style={sub}>{t("w3_sub_req")}</p>

          {!isBiz && (
            <>
              <BigField fid="rate" error={ferr("rate")} label={<>{formKind === "ride" ? t("w3_rate_drv") : t("w3_rate")}<ReqTag /></>}>
                <div style={{ display: "flex", gap: 9 }}>
                  <input style={{ ...bigInput, flex: 1 }} inputMode="numeric" value={f.day_rate_min}
                         placeholder={t("w3_rate_from")}
                         onChange={(e) => set("day_rate_min", e.target.value)} />
                  <input style={{ ...bigInput, flex: 1 }} inputMode="numeric" value={f.day_rate_max}
                         placeholder={t("w3_rate_to")}
                         onChange={(e) => set("day_rate_max", e.target.value)} />
                </div>
              </BigField>

              <BigField fid="years" error={ferr("years")} label={<>{t("w3_years")}<ReqTag /></>}>
                <input style={bigInput} inputMode="numeric" value={f.years_experience}
                       onChange={(e) => set("years_experience", e.target.value)} />
              </BigField>
            </>
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

          <BigField fid="about" error={ferr("about")} label={<>{t("w3_about")}<ReqTag /></>}>
            <textarea style={{ ...bigInput, minHeight: 92, resize: "vertical" }} value={f.about}
                      placeholder={t(formKind === "eat" ? "ea_about_ph" : "w3_about_ph")}
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

          {hasItemsStep ? (
            <Btn full onClick={() => {
              if (!isBiz) {
                const lo = Number(f.day_rate_min), hi = Number(f.day_rate_max);
                if (!(lo > 0) || !(hi > 0) || hi < lo) return bad("rate", t("e_rate"));
                if (String(f.years_experience).trim() === "" || !(Number(f.years_experience) >= 0)) return bad("years", t("e_years"));
              }
              if (!f.about.trim()) return bad("about", t("e_about"));
              setErr(null); setFieldErr(null); setStep(4);
            }}>{t("w_next")}</Btn>
          ) : (
            <Btn full onClick={submit} disabled={busy}>
              {busy ? t("w_sending") : isAdmin ? t("w_submit_admin") : t("w_submit")}
            </Btn>
          )}
        </>
      )}

      {/* ---------------------------------------- 4. goods or menu (shop, food) */}
      {step === 4 && hasItemsStep && (
        <>
          <h2 style={title}>{formKind === "eat" ? t("lf_menu_title") : t("lf_prod_title")}</h2>
          <p style={sub}>{formKind === "eat" ? t("lf_menu_sub") : t("lf_prod_sub")}</p>

          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, marginBottom: 8 }}>
              <span style={{ width: 46, height: 46, borderRadius: 10, flex: "none", background: it.photo ? `center/cover url(${it.photo}) ${T.line}` : T.brandSoft }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                <span style={{ display: "block", fontSize: 13, color: T.inkSoft }}>₹{it.price}{it.category ? ` · ${it.category}` : ""}</span>
              </span>
              <button onClick={() => setItems((x) => x.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: T.inkSoft, fontWeight: 700, cursor: "pointer", minHeight: 44, fontFamily: "inherit" }}>{t("lf_remove")}</button>
            </div>
          ))}

          <div style={{ border: `1.5px dashed ${T.brandDark}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ width: 64, height: 64, borderRadius: 12, flex: "none", background: draft.photo ? `center/cover url(${draft.photo}) ${T.line}` : T.brandSoft, display: "flex", alignItems: "center", justifyContent: "center", color: T.brandDark }}>
                {!draft.photo && <Icon name="camera" size={24} />}
              </span>
              <label style={{ color: T.brandDark, fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>
                {itemBusy ? t("ow_uploading") : draft.photo ? t("ow_photo_change") : t("ow_photo")}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pickItemPhoto(e.target.files && e.target.files[0])} />
              </label>
            </div>
            <input style={{ ...bigInput, marginBottom: 8 }} value={draft.name} maxLength={80} placeholder={t("ow_name")} aria-label={t("ow_name")} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            <input style={{ ...bigInput, marginBottom: 8 }} value={draft.price} inputMode="numeric" maxLength={5} placeholder={t("ow_price")} aria-label={t("ow_price")} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value.replace(/\D/g, "") }))} />
            <input style={{ ...bigInput, marginBottom: 8 }} value={draft.category} maxLength={40} placeholder={t("ow_cat")} aria-label={t("ow_cat")} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} />
            {formKind === "eat" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, fontSize: 15, marginBottom: 6 }}>
                <input type="checkbox" checked={draft.veg} onChange={(e) => setDraft((d) => ({ ...d, veg: e.target.checked }))} /> {t("ow_veg")}
              </label>
            )}
            <Btn full kind="ghost" onClick={addItem} disabled={itemBusy}>{t("lf_add_item")}</Btn>
          </div>

          <Btn full onClick={submit} disabled={busy || itemBusy}>
            {busy ? t("w_sending") : items.length ? t("w_submit") : t("lf_skip")}
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
      .then((r) => { if (alive) { setD(one(r)); api.logAdminAccess(workerId, "listing"); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [api, workerId]);

  const showId = async () => {
    setIdErr(false);
    api.logAdminAccess(workerId, "id_document");
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
              <Field label={<>{t("w3_vehicle")}<ReqTag /></>}>
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
                {t("adm_id_title")}{d.requires_id && <ReqTag />}
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

function AdminWithdrawals({ api }) {
  const [list, setList] = useState([]);
  const [status, setStatus] = useState("requested");
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    api.adminWithdrawals(status).then((r) => setList(many(r))).catch(() => setList([]));
  }, [api, status]);
  useEffect(() => { load(); }, [load]);
  const rs = (p) => `\u20b9${(Number(p) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const act = async (id, s) => {
    if (s === "rejected" && !(notes[id] || "").trim()) { setMsg("Write the reason first."); return; }
    setBusyId(id); setMsg("");
    try {
      const r = one(await api.adminWithdrawalSet(id, s, notes[id]));
      if (!r || !r.ok) setMsg(`Not done: ${(r && r.reason) || "error"}`);
      load();
    } catch (e) { setMsg((e && e.message) || "Failed"); }
    finally { setBusyId(null); }
  };
  return (
    <div style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 4px" }}>Withdrawal requests</h2>
      <div style={{ fontSize: 13, color: T.inkFaint, marginBottom: 10, lineHeight: 1.5 }}>
        Pay the amount to the UPI ID in your own UPI app, then press Mark paid (add the UTR as the note).
        Reject sends the money back to their wallet; keep the reason as a note for your own records.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {["requested", "paid", "rejected"].map((k) => (
          <Btn key={k} kind={status === k ? "primary" : "ghost"}
               style={{ padding: "8px 14px", minHeight: 38, fontSize: 13.5 }}
               onClick={() => setStatus(k)}>{k}</Btn>
        ))}
      </div>
      {msg && <div style={{ fontSize: 13, color: T.red, marginBottom: 8 }}>{msg}</div>}
      {list.length === 0 ? (
        <div style={{ fontSize: 14, color: T.inkFaint }}>None.</div>
      ) : list.map((w) => (
        <div key={w.id} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{rs(w.amount_paise)} → {w.upi_id}</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>
            {w.full_name || "—"} · {w.phone || "—"} · {Number(w.listings) || 0} approved listing(s) · {new Date(w.created_at).toLocaleString("en-IN")}
          </div>
          {w.note && <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>Note: {w.note}</div>}
          {w.status === "requested" && (
            <>
              <input value={notes[w.id] || ""} maxLength={120}
                     onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
                     placeholder="UTR number, or the reason if rejecting"
                     style={{ ...input, marginTop: 8, minHeight: 42 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn disabled={busyId === w.id} onClick={() => act(w.id, "paid")}>Mark paid</Btn>
                <Btn kind="ghost" style={{ color: T.red }} disabled={busyId === w.id}
                     onClick={() => act(w.id, "rejected")}>Reject</Btn>
              </div>
            </>
          )}
        </div>
      ))}
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
  isAdmin = false, onSignIn, onSignOut, onProfileSaved, onSessionTokens,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [offerPick, setOfferPick] = useState(false);
  const [offerTrade, setOfferTrade] = useState(null);
  const [locOpen, setLocOpen] = useState(false);
  // Buy & Sell: the ad open on top of whatever tab, and the ad being edited.
  // A shared link (?item=<id>) opens that ad straight away.
  const [itemOpen, setItemOpen] = useState(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("item");
      return id && /^[0-9a-f-]{36}$/i.test(id) ? { id } : null;
    } catch (_) { return null; }
  });
  const [editItem, setEditItem] = useState(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifJobs, setNotifJobs] = useState([]);
  const [chatItem, setChatItem] = useState(null);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [bookRow, setBookRow] = useState(null);
  const [myTrade, setMyTrade] = useState(null);
  // FIRST SCREENS: after the language, "I need" or "I offer"; for "I offer",
  // what is offered. Shown once on a new phone, and never to somebody who is
  // already signed in.
  const [start, setStart] = useState(() => {
    return null;
  });
  const [offerType, setOfferType] = useState(() => {
    try { return window.localStorage.getItem("dhundo_offer_type") || null; } catch (_) { return null; }
  });
  const finishStart = () => {
    try { window.localStorage.setItem("dhundo_started", "1"); } catch (_) {}
    setStart(null);
  };
  const [phoneOk, setPhoneOk] = useState(null);
  useEffect(() => {
    if (!user || !user.id) { setPhoneOk(null); return undefined; }
    let alive = true;
    Promise.resolve(api.phoneVerified()).then((v) => {
      const val = Array.isArray(v) ? v[0] : v;
      if (alive) setPhoneOk(val === true ? true : val === false ? false : null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [user && user.id, verifyOpen, walletOpen]); // eslint-disable-line react-hooks/exhaustive-deps
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
            pin: /^\d{6}$/.test(String(p.pin || "")) ? String(p.pin) : undefined,
            address: typeof p.address === "string" && p.address ? p.address : undefined,
            exact: p.exact === true ? true : undefined,
            // Saved before post office suffixes were dropped: "Dharmanagar H.O".
            city: typeof p.city === "string" && p.city
              ? p.city.replace(/\s+(?:H\.?\s?O|S\.?\s?O|B\.?\s?O|G\.?\s?P\.?\s?O)\.?$/i, "").trim() : undefined,
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

  // The position, PIN, town and address belong to the state they were found
  // in. A saved place whose position does not fit its state (Tripura's
  // coordinates under Haryana) would show people from the wrong state, so it
  // is cut back to the area and the state, and asked for again.
  useEffect(() => {
    if (!placeIsCoherent(place)) {
      setPlace((p) => ({ area: p.area, state: p.state }));
    }
  }, [place.lat, place.lng, place.state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { window.localStorage.setItem("dhundo_place", JSON.stringify(place)); } catch (_) {}
  }, [place]);

  // ONE LOCATION FOR THE PERSON, everywhere except a listing. Set it on the
  // landing screen and it is saved to their profile; set it in Edit profile
  // and the landing screen follows; sign in on another phone and it is there.
  // A listing keeps its own location, always separate.
  const saveHome = useCallback(async (p) => {
    if (!user || !user.id || !p || typeof p.lat !== "number" || !STATES.includes(p.state)) return;
    // Storing an address is a yes first (asked once, remembered).
    if (!(await consent.ask("profile"))) return;
    try {
      const cur = (await api.myProfile()) || {};
      await api.updateMyProfile({
        full_name: cur.full_name || (user && user.full_name) || "", email: cur.email || "",
        address: p.address || "", city: p.area || "", state: p.state, pincode: p.pin || "",
      });
      await api.setHome(p.lat, p.lng, !!p.exact);
    } catch (_) { /* the screen already shows it; saving it is a convenience */ }
  }, [api, user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !user.id) return undefined;
    let alive = true;
    api.myProfile().then((p) => {
      if (!alive || !p) return;
      if (typeof p.home_lat === "number" && typeof p.home_lng === "number" && STATES.includes(p.state)) {
        // The saved profile location wins: it is the one every device shares.
        setPlace({
          area: p.city || "", state: p.state, lat: p.home_lat, lng: p.home_lng,
          pin: /^\d{6}$/.test(String(p.pincode || "")) ? String(p.pincode) : undefined,
          address: p.address || undefined, exact: p.home_exact === true ? true : undefined,
        });
      } else if (typeof place.lat === "number" && consent.has("profile")) {
        // Set before signing in: carried into the new account.
        saveHome(place);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // An area saved before places carried a position (or typed by hand): look
  // its position up once, so the search sorts by distance instead of
  // matching the area name exactly.
  useEffect(() => {
    if (!place.area || typeof place.lat === "number") return;
    let alive = true;
    placeCoords(place.state, place.area).then((xy) => {
      if (alive && xy) setPlace((p) => (p.area === place.area && typeof p.lat !== "number" ? { ...p, ...xy } : p));
    }).catch(() => {});
    return () => { alive = false; };
  }, [place.area, place.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // A position with no PIN code: the nearest PIN, so "same PIN code first"
  // works for everybody, not only those who typed theirs.
  // By position when there is one, else by the area name.
  useEffect(() => {
    if (place.pin || (typeof place.lat !== "number" && !place.area)) return;
    let alive = true;
    pinForPlace({ lat: place.lat, lng: place.lng, name: place.area, state: place.state }).then((r) => {
      if (alive && r) setPlace((p) => (p.area === place.area && p.lat === place.lat && !p.pin
        ? { ...p, pin: r.pincode, city: p.city || r.place || undefined } : p));
    }).catch(() => {});
    return () => { alive = false; };
  }, [place.lat, place.lng, place.pin, place.area]); // eslint-disable-line react-hooks/exhaustive-deps

  // Right after sign-up: offer to check the phone, once. Skippable; the
  // wallet keeps the reminder until it is done.
  useEffect(() => {
    if (!user || !user.id) return undefined;
    let flag = null;
    try { flag = window.localStorage.getItem("dhundo_verify_prompt"); } catch (_) {}
    if (!flag) return undefined;
    try { window.localStorage.removeItem("dhundo_verify_prompt"); } catch (_) {}
    let alive = true;
    Promise.resolve(api.phoneVerified()).then((v) => {
      if (alive && v === false) setVerifyOpen(true);
    }).catch(() => {});
    return () => { alive = false; };
  }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const geo = useMyLocation();
  const consent = useConsent();
  // Withdrawing the location consent takes the phone's position out of the
  // saved place at once; the area name the person chose stays.
  useEffect(() => {
    const onConsent = (e) => {
      if (e.detail && e.detail.purpose === "location" && !e.detail.granted) {
        setPlace((p) => ({ ...p, lat: undefined, lng: undefined }));
      }
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);
  useEffect(() => {
    let done = false;
    try { done = window.localStorage.getItem("dhundo_geo_tried") === "1"; } catch (_) {}
    // Never on a first visit: this runs only for someone who already said
    // yes. Everybody else is asked by the card on the home screen, or by the
    // button that needs the location.
    if (done || !geo.supported || !consent.has("location")) return;
    try { window.localStorage.setItem("dhundo_geo_tried", "1"); } catch (_) {}
    let alive = true;
    geo.detect().then(async (got) => {
      if (!alive || !got) return;
      if (got.state && !STATES.includes(got.state)) { setOutside(got.state); return; }
      // The village from the place table, the address and the PIN, for the
      // spot the phone is at.
      const d = await describePoint({ lat: got.lat, lng: got.lng, state: got.state,
                                      address: got.address, area: got.area, accuracy: got.accuracy });
      if (!alive) return;
      setPlace((p) => ({
        area: d.area || p.area,
        state: d.state && STATES.includes(d.state) ? d.state : p.state,
        lat: d.lat, lng: d.lng, pin: d.pin || undefined, city: d.town || undefined,
        address: d.line || undefined, exact: true,
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
    api.listTrades(false, state).then((r) => setTrades(many(r).filter((x) => !STAY_TRADES.includes(x.slug)))).catch(() => setTrades([]));
  }, [api, reloadKey, state]);

  const signedIn = !!(user && user.id);
  const inbox = useInbox(api, signedIn);
  // What needs attention on the Orders tab: orders waiting for the restaurant or
  // shop, a delivery charge or pickup waiting for the customer to answer, a
  // second hand request waiting for the seller.
  const [ordersBadge, setOrdersBadge] = useState(0);
  const [ordersKey, setOrdersKey] = useState(0);
  const openOrders = (sub) => { try { window.localStorage.setItem("dhundo_orders_tab", sub || ""); } catch (_) {} setOrdersKey((k) => k + 1); setTab("orders"); };
  useEffect(() => {
    if (!signedIn) { setOrdersBadge(0); return undefined; }
    let live = true;
    const pull = async () => {
      try {
        const [o, it] = await Promise.all([api.myOrders().catch(() => []), api.myItemOrders ? api.myItemOrders().catch(() => []) : []]);
        const a = (Array.isArray(o) ? o : []).filter((x) => (x.role === "owner" && x.status === "placed") || (x.role === "customer" && x.status === "quoted")).length;
        const b = (Array.isArray(it) ? it : []).filter((x) => x.role === "seller" && x.status === "requested").length;
        if (live) setOrdersBadge(a + b);
      } catch (_) { /* next tick */ }
    };
    pull();
    const id = setInterval(pull, 15000);
    return () => { live = false; clearInterval(id); };
  }, [api, signedIn]);
  const openNotif = () => {
    inbox.markSeen();
    api.myJobs().then((r) => setNotifJobs(Array.isArray(r) ? r : r ? [r] : [])).catch(() => {});
    setNotifOpen(true);
  };

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
      .then((r) => { if (alive) { setHasListing(!!(one(r) && one(r).id)); setMyTrade((one(r) && one(r).trade_slug) || null); } })
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
  // Read once, before the effect above overwrites it with the first screen.
  const savedMode = useRef((() => {
    try { return window.localStorage.getItem("dhundo_mode"); } catch (_) { return null; }
  })());
  useEffect(() => {
    if (!hasListing || isAdmin || modeChosen.current) return;
    modeChosen.current = true;
    const saved = savedMode.current;
    if (saved !== "find" && tab === "browse") setTab("work");
    // Only on first learning that this person has a listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasListing, isAdmin]);

  // THE SWITCH AT THE TOP: "I need" (find help, buy and sell) or "I offer"
  // (the dashboard, my listing, wallet). It follows the screen: opening a
  // customer screen makes it "need", opening a business screen makes it
  // "offer", and the account screens keep whichever was last. Switching
  // simply opens the first screen of the other half.
  const [mode, setModeState] = useState(() => {
    try { return window.localStorage.getItem("dhundo_mode") === "work" ? "offer" : "need"; } catch (_) { return "need"; }
  });
  useEffect(() => {
    const need = ["browse", "market"];
    const offer = ["work", "mine", "add", "sell"];
    if (need.includes(tab)) setModeState("need");
    else if (offer.includes(tab)) setModeState("offer");
  }, [tab]);
  const switchMode = (m) => {
    if (m === mode && (m === "need" ? tab === "browse" : tab === "work")) return;
    setModeState(m);
    setTab(m === "need" ? "browse" : "work");
  };

  // The heartbeat runs here, not in the Work screen, so a worker's
  // position keeps going while they look at their listing or wallet.
  const avail = useAvailability(api, signedIn && hasListing && !isAdmin);

  // A driver who is online hears about ride requests from anywhere in the
  // app: they count on the bell, sound the alert, and can be accepted from
  // the notification list, not only from the Work screen.
  const myTradeRow = trades.find((x) => x.slug === myTrade) || {};
  const myDriverKind = myTradeRow.group_name === "Drivers" ? driverKind(myTradeRow) : null;
  const isDriver = myDriverKind === "travel";
  const [rideReqs, setRideReqs] = useState([]);
  useEffect(() => {
    if (!(signedIn && hasListing && isDriver && avail.online)) { setRideReqs([]); return undefined; }
    let live = true;
    const pull = () => api.ridesNearby().then((r) => { if (live) setRideReqs(Array.isArray(r) ? r : r ? [r] : []); }).catch(() => {});
    pull();
    const id = setInterval(pull, 4000);
    return () => { live = false; clearInterval(id); };
  }, [api, signedIn, hasListing, isDriver, avail.online]);
  const rideKey = rideReqs.map((r) => r.id).join(",");
  useEffect(() => {
    if (!rideKey || tab === "work" || tab === "orders") return undefined;
    alertNewJob();
    const id = setInterval(alertNewJob, 8000);
    return () => clearInterval(id);
  }, [rideKey, tab]);

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
        notifCount={signedIn ? inbox.alerts + rideReqs.length : 0}
        onOpenNotifications={signedIn ? openNotif : null}
        mode={mode}
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

      {menuOpen && (() => {
        // Everything in one list, not tucked inside other screens.
        const biz = hasListing && !isAdmin;
        const isOwner = biz && (myTradeRow.group_name === "Eat & Stay" || myTradeRow.kind === "supplier");
        const isRider = biz && (myDriverKind === "delivery" || myDriverKind === "travel");
        const go = (tb) => () => setTab(tb);
        const activity = [
          { icon: "bag", title: t("or_title"), sub: t("or_mine"), badge: ordersBadge, go: () => openOrders("mine") },
          { icon: "chat", title: t("ch_tab"), badge: inbox.unread, go: go("chats") },
          { icon: "bell", title: t("nt_title"), badge: inbox.alerts + rideReqs.length, go: openNotif },
          { icon: "tag", title: t("mb_mine"), go: () => openOrders("items") },
          { icon: "tag", title: t("offer_sell"), go: go("sell") },
        ];
        const business = [];
        if (isOwner) {
          business.push({ icon: "bag", title: t("m_received"), go: () => openOrders("work") });
          business.push({ icon: "edit", title: t("m_menu_items"), sub: t("m_hours"), go: go("work") });
        }
        if (biz && myDriverKind === "delivery") business.push({ icon: "drivers", title: t("m_rider_jobs"), go: () => openOrders("work") });
        if (biz && myDriverKind === "travel") business.push({ icon: "drivers", title: t("m_rides"), go: () => openOrders("work") });
        if (isRider) business.push({ icon: "check", title: t("m_online"), sub: avail.online ? t("av_on") : t("av_off"), go: go("work") });
        if (biz && myDriverKind === "hire") business.push({ icon: "edit", title: t("m_rates"), go: go("work") });
        if (biz && !isOwner && !isRider && myDriverKind !== "hire") business.push({ icon: "check", title: t("m_online"), go: go("work") });
        if (biz) business.push({ icon: "user", title: t("nav_mine"), go: go("mine") });
        if (!biz && signedIn) business.push({ icon: "plus", title: t("nav_list"), go: go("add") });
        const money = [{ icon: "wallet", title: t("wal_title"), go: () => setWalletOpen(true) }];
        const sections = [
          { title: t("ms_activity"), rows: activity },
          business.length ? { title: t("ms_business"), rows: business } : null,
          { title: t("ms_money"), rows: money },
        ].filter(Boolean);
        return (
          <MenuSheet api={api} mode={mode} onMode={switchMode} signedIn={signedIn} sections={sections}
                     onInstall={() => setInstallOpen(true)} onAccount={() => setTab("account")}
                     onClose={() => setMenuOpen(false)} />
        );
      })()}
      {installOpen && <InstallSheet onClose={() => setInstallOpen(false)} />}
      {bookRow && signedIn && <BookingSheet api={api} row={bookRow} place={place} onClose={() => setBookRow(null)} />}
      {notifOpen && signedIn && (
        <NotificationsSheet api={api} items={inbox.items} jobs={notifJobs} rides={rideReqs}
                            onRides={() => { setNotifOpen(false); setTab("work"); }} onChanged={inbox.reload}
                            onClose={() => setNotifOpen(false)}
                            onChat={(x) => { setNotifOpen(false); setChatItem(x); }} />
      )}
      {chatItem && signedIn && <ChatScreen api={api} item={chatItem} onChanged={inbox.reload} onClose={() => { setChatItem(null); inbox.reload(); }} />}
      {partnerOpen && <PartnerSheet api={api} signedIn={signedIn} onSignIn={onSignIn} onClose={() => setPartnerOpen(false)} />}
      {verifyOpen && signedIn && (
        <PhoneVerifySheet api={api} phone={user && user.phone}
                          onClose={() => setVerifyOpen(false)}
                          onDone={() => setVerifyOpen(false)} />
      )}
      {walletOpen && signedIn && (
        <WalletSheet api={api} phone={user && user.phone} PhoneVerify={PhoneVerifySheet}
                     onClose={() => setWalletOpen(false)} />
      )}
      {locOpen && (
        <LocationSheet
          place={place}
          onChange={(p) => { setPlace(p); setOutside(null); saveHome(p); }}
          onClose={() => setLocOpen(false)}
        />
      )}

      {tab === "browse" && offerPick && (
        <OfferTypeGate inline trades={trades}
          onBack={() => setOfferPick(false)}
          onPick={(type, trade) => {
            try { window.localStorage.setItem("dhundo_offer_type", type); } catch (_) {}
            setOfferType(type); setOfferTrade(trade || null);
            setOfferPick(false);
            if (type === "sell") { setTab("sell"); } else { setTab("add"); }
          }} />
      )}
      {tab === "browse" && !offerPick && (
        <Browse
          api={api} trades={trades} user={user} isAdmin={isAdmin}
          onSignIn={onSignIn}
          // Somebody who already listed and taps "List yourself" in the empty
          // state means "let me deal with my listing", so send them there.
          onAdd={() => setTab(hasListing && !isAdmin ? "mine" : "add")}
          place={place} setPlace={setPlace}
          onInstall={() => setInstallOpen(true)}
          onPickLocation={() => setLocOpen(true)}
          onMarket={() => setTab("market")}
          onPartner={() => setPartnerOpen(true)}
          onOffer={() => { if (hasListing && !isAdmin) switchMode("offer"); else setOfferPick(true); }}
          onBook={(row) => { if (!signedIn) { onSignIn && onSignIn(); return; } setBookRow(row); }}
        />
      )}

      {tab === "market" && (
        <MarketPage api={api} place={place} state={state} onBack={() => setTab("browse")} user={signedIn ? user : null}
                    onHire={() => { try { window.localStorage.setItem("dhundo_ride_mode", "hire"); window.localStorage.setItem("dhundo_open_section", "ride"); } catch (_) {} setItemOpen(null); setTab("browse"); }}
                    onOpenItem={(it) => setItemOpen({ id: it.id, km: it.distance_km })}
                    />
      )}

      {tab === "sell" && (
        <SellPage api={api} user={signedIn ? user : null} place={place} onSignIn={onSignIn}
                  onBack={() => { if (signedIn) setTab("work"); else { setOfferPick(true); setTab("browse"); } }}
                  onPickLocation={() => setLocOpen(true)}
                  onOpenItem={(it) => setItemOpen({ id: it.id })}
                  editId={editItem} setEditId={setEditItem} />
      )}

      {itemOpen && (
        <ItemDetail api={api} id={itemOpen.id} distanceKm={itemOpen.km ?? null}
                    user={signedIn ? user : null} onSignIn={onSignIn}
                    onHire={() => { try { window.localStorage.setItem("dhundo_ride_mode", "hire"); window.localStorage.setItem("dhundo_open_section", "ride"); } catch (_) {} setItemOpen(null); setTab("browse"); }}
                    onClose={() => {
                      setItemOpen(null);
                      try {
                        const u = new URL(window.location.href);
                        if (u.searchParams.has("item")) { u.searchParams.delete("item"); window.history.replaceState(null, "", u); }
                      } catch (_) {}
                    }}
                    onEdit={(id) => { setItemOpen(null); setEditItem(id); setTab("sell"); }} />
      )}

      {tab === "work" && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "10px 16px 0" }}>
          <HomeButton onClick={() => setTab("browse")} />
        </div>
      )}
      {tab === "work" && (
        <WorkerHome
          extra={(() => {
            const tr = trades.find((x) => x.slug === myTrade) || {};
            if (!signedIn || !hasListing || isAdmin) return null;
            if (tr.group_name === "Drivers") {
              const dk = driverKind(tr);
              // A delivery rider works the delivery jobs of shops and restaurants;
              // a hire vehicle lists its rates; a ride driver takes ride requests.
              if (dk === "delivery") return <AlertsCard api={api} />;
              if (dk === "hire") return <RatesCard api={api} />;
              return <><RideTools api={api} online={avail.online} /><RatesCard api={api} /></>;
            }
            if (tr.kind === "supplier" || tr.group_name === "Suppliers" || tr.group_name === "Eat & Stay")
              return <><OwnerFood api={api} shop={tr.group_name !== "Eat & Stay"} onHire={() => { try { window.localStorage.setItem("dhundo_ride_mode", "hire"); window.localStorage.setItem("dhundo_open_section", "ride"); } catch (_) {} switchMode("need"); }} onOpenOrders={() => setTab("orders")} />{tr.group_name !== "Eat & Stay" && <ShopJobs api={api} hasListing={hasListing} collapsed />}</>;
            return <RatesCard api={api} />;
          })()}
          top={signedIn && hasListing && !isAdmin ? (isDriver ? <RideRequests api={api} online={avail.online} trades={trades} where={avail.where} /> : myDriverKind === "delivery" ? <RiderJobs api={api} online={avail.online} where={avail.where} /> : null) : null}
          avail={avail} signedIn={signedIn} hasListing={hasListing}
          onSignIn={onSignIn}
          onList={() => setTab("add")}
          onOpenListing={() => setTab("mine")}
        />
      )}

      {tab === "mine" && signedIn && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "14px 16px 60px" }}>
          <div style={{ marginBottom: 12 }}><HomeButton onClick={() => setTab("browse")} /></div>
          <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 18px" }}>{t("nav_mine")}</h1>
          <MyListing api={api} trades={trades} isAdmin={isAdmin}
                     onGoAdd={() => setTab("add")} />
        </div>
      )}

      {tab === "add" && !signedIn && (
        <SignInGate art={offerType === "ride" ? "ride" : offerType === "shop" ? "shop" : offerType === "eat" ? "eat" : "worker"}
                    onBack={() => { setOfferPick(true); setTab("browse"); }} onSignIn={onSignIn}
                    title={t("add_title")} text={t("add_sub")}
                    note={offerTrade && trades.find((x) => x.slug === offerTrade) ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: T.brandSoft, borderRadius: 10,
                                    padding: "8px 12px", margin: "0 0 14px", fontWeight: 800, fontSize: 15 }}>
                        <Icon name="check" size={17} /> {tradeName(trades.find((x) => x.slug === offerTrade), lang)}
                      </div>
                    ) : null}
                    perks={[[t("trust_2_t"), t("trust_2_s")], [t("trust_3_t"), t("trust_3_s")]]} />
      )}

      {tab === "orders" && (signedIn ? (
        <OrdersPage key={ordersKey} api={api} online={avail.online} where={avail.where} trades={trades}
                    role={hasListing && !isAdmin ? ((myTradeRow.group_name === "Eat & Stay" || myTradeRow.kind === "supplier") ? "owner" : myDriverKind === "delivery" ? "delivery" : myDriverKind === "travel" ? "ride" : null) : null}
                    onHire={() => { try { window.localStorage.setItem("dhundo_ride_mode", "hire"); window.localStorage.setItem("dhundo_open_section", "ride"); } catch (_) {} switchMode("need"); }} />
      ) : (
        <SignInGate onBack={() => setTab("browse")} onSignIn={onSignIn} title={t("or_tab")} text={t("or_gate")}
                    perks={[[t("trust_2_t"), t("trust_2_s")]]} />
      ))}

      {tab === "chats" && (signedIn ? (
        <ChatsPage items={inbox.items} onOpen={(x) => setChatItem(x)} onHome={() => setTab("browse")} alerts={inbox.alerts} onRequests={openNotif}
                   onDelete={async (x) => { try { await api.chatDelete(x.id); } catch (_) { /* the list reloads */ } inbox.reload(); }} />
      ) : (
        <SignInGate onBack={() => setTab("browse")} onSignIn={onSignIn} title={t("ch_tab")} text={t("ch_gate")}
                    perks={[[t("trust_2_t"), t("trust_2_s")]]} />
      ))}

      {tab !== "browse" && tab !== "mine" && tab !== "work" && tab !== "account" && tab !== "profile" && tab !== "chats" && tab !== "orders" &&
       tab !== "market" && tab !== "sell" && !(tab === "add" && !signedIn) && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "14px 16px 60px" }}>
          {tab === "add" && (
            <>
              {!isAdmin && hasListing && (
                <div style={{ marginBottom: 14 }}>
                  <HomeButton label={t("w_back")} onClick={() => { setOfferPick(true); setTab("browse"); }} />
                </div>
              )}
              <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 6px" }}>
                {isAdmin ? t("add_title_admin") : t("add_title")}
              </h1>
              <p style={{ fontSize: 14.5, color: T.inkSoft, margin: "0 0 20px", lineHeight: 1.6, maxWidth: 520 }}>
                {isAdmin ? t("add_sub_admin") : t("add_sub")}
              </p>
              {!signedIn ? (
                <>
                  {offerTrade && (trades.find((x) => x.slug === offerTrade)) && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: T.white, border: `1px solid ${T.line}`,
                                  borderRadius: 12, padding: "10px 14px", margin: "0 0 14px", fontWeight: 800, fontSize: 16 }}>
                      <Icon name="check" size={18} /> {tradeName(trades.find((x) => x.slug === offerTrade), lang)}
                    </div>
                  )}
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
                             startGroup={{ ride: "Drivers", hire: "Drivers", shop: "Suppliers", eat: "Eat & Stay" }[offerType] || null}
                             startTrade={offerTrade}
                             place={place} setPlace={setPlace}
                             onBack={() => setTab(isAdmin ? "browse" : "work")}
                             onDone={() => setReloadKey((k) => k + 1)}
                             onNext={() => setTab("work")} />
              )}
            </>
          )}

          {tab === "manage" && isAdmin && (
            <>
              <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 18px" }}>{t("manage_title")}</h1>
              <AdminMfaCard api={api} onSession={onSessionTokens} onSignOut={onSignOut} />
              <AdminList api={api} trades={trades} reloadKey={reloadKey} />
              <AdminWithdrawals api={api} />
              <AdminAds api={api} onOpenItem={(it) => setItemOpen({ id: it.id })} />
            </>
          )}
        </div>
      )}

      {tab === "account" && (
        <AccountPage
          account={signedIn ? user : null}
          walletPaise={walletPaise}
          phoneOk={phoneOk}
          onVerifyPhone={() => setVerifyOpen(true)}
          onOpenWallet={() => setWalletOpen(true)}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onInstall={() => setInstallOpen(true)}
          hasListing={hasListing}
          onOpenListing={() => setTab("mine")}
          onList={() => setTab("add")}
          onOpenProfile={() => setTab("profile")}
          onOpenAds={() => setTab("sell")}
          showCredits={inApp}
          privacy={<PrivacyLinks api={api} />}
        />
      )}

      {tab === "profile" && signedIn && (
        <ProfilePage api={api} account={user} hasListing={hasListing} PlaceFieldComp={PlaceField} currentPlace={place}
                     onLocation={(p) => setPlace((cur) => ({ ...cur, ...p, source: "picked" }))}
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
                 signedIn={signedIn} hasListing={hasListing} mode={mode}
                 onWallet={signedIn ? () => setWalletOpen(true) : null}
                 onMenu={() => setMenuOpen(true)} chatBadge={signedIn ? inbox.unread : 0} ordersBadge={signedIn ? ordersBadge : 0}
                 ordersLabel={hasListing && !isAdmin && (myDriverKind === "delivery" || myDriverKind === "travel") ? t("or_rider") : null}
                 ordersIcon={hasListing && !isAdmin && (myDriverKind === "delivery" || myDriverKind === "travel") ? "drivers" : "bag"} />
    </div>
  );
}
