// Renders the built app against stubbed RPCs and writes screenshots.
// The point is to look at it, not to test it: every UI mistake so far
// (a header wrapping mid-word, a grid of two tiles, a house for
// "Construction") was invisible in the source and obvious in a picture.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("dist");
const TYPES = { ".html":"text/html", ".js":"text/javascript", ".png":"image/png",
                ".webmanifest":"application/manifest+json", ".json":"application/json" };

const srv = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(4173, r));

const GROUPS = ["Construction","Drivers","Home & Domestic","Food","Repairs","Vehicle","Events","Suppliers"];
const trades = GROUPS.flatMap((g, gi) =>
  Array.from({ length: 4 }, (_, i) => ({
    slug: `t${gi}-${i}`, name_en: `${g} job ${i + 1}`, name_bn: null, name_hi: null,
    kind: "worker", group_name: g, sort_order: gi * 10 + i,
    listing_count: gi === 0 ? 3 - i : 0,
    requires_vehicle: g === "Drivers", requires_id: g === "Drivers" || g === "Home & Domestic",
  })));

const workers = [
  { id:"1", full_name:"Ranjit Debbarma", trade_slug:"t0-0", trade_name:"Mason",
    other_trades:[], years_experience:12, day_rate_min:700, day_rate_max:900,
    locality:"Krishnanagar", city:"Agartala", about:"Brick work, plaster, small repairs.",
    languages:["Bengali","Hindi"], photos:[], verified:true, total_count:2 },
  { id:"2", full_name:"Sujit Das", trade_slug:"t0-1", trade_name:"Carpenter",
    other_trades:[], years_experience:6, day_rate_min:800, day_rate_max:null,
    locality:"Banamalipur", city:"Agartala", about:"Doors, windows, furniture.",
    languages:["Bengali"], photos:[], verified:false, total_count:2 },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

const errors = [];

async function shot(name, { width, height, lang, go, signedIn = true, listing = true, admin = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  // A build that compiles can still throw on render -- a hook used without
  // being imported blanked My listing once and only this caught it.
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.route("**/rest/v1/rpc/**", (route) => {
    const u = route.request().url();
    const body = u.includes("list_trades") ? trades
               : u.includes("browse_workers") ? workers
               : u.includes("unblock_phone") ? [{ ok:true, reason:"unblocked" }]
               : u.includes("admin_worker_detail") ? [{
                   id:"w1", full_name:"Ranjit Debbarma", business_name:null,
                   phone:"919862012345", trade_slug:"t1-0", trade_name:"Drivers job 1",
                   group_name:"Drivers", other_trades:["t1-1"], years_experience:8,
                   day_rate_min:700, day_rate_max:900,
                   about:"Airport runs, outstation, night drops.",
                   languages:["Bengali"], photos:[], avatar_url:null,
                   locality:"Krishnanagar", city:"Agartala", state:"Tripura",
                   address_line:"House 12, Ward 4", landmark:"Near the water tank",
                   pincode:"799001", address_public:false,
                   lat:23.8315, lng:91.2868, loc_source:"device",
                   vehicle_number:"TR01AB1234", same_vehicle_count:2,
                   requires_vehicle:true, requires_id:true, gaps:["id_doc"],
                   has_id_doc:false, id_doc_path:null, id_doc_uploaded_at:null,
                   available:true, verified:false, status:"pending", source:"self",
                   contact_views:4, created_at:new Date().toISOString(),
                   updated_at:new Date().toISOString(),
                   account_id:"acc-9", rejection_reason:null,
                 }]
               : u.includes("admin_list") ? [{
                   id:"w1", full_name:"Ranjit Debbarma", phone:"919862012345",
                   trade_slug:"t1-0", trade_name:"Drivers job 1",
                   locality:"Krishnanagar", city:"Agartala", state:"Tripura",
                   years_experience:8, day_rate_min:700, day_rate_max:900,
                   verified:false, status:"pending", source:"self",
                   contact_views:4, created_at:new Date().toISOString(),
                   total_count:1, has_id_doc:false, id_doc_path:null,
                 }]
               : u.includes("delete_my_listing") || u.includes("admin_delete_listing")
                 ? [{ ok:true, reason:"deleted" }]
               : u.includes("services_cities") ? [
                   { id:1, place:"Panisagar", district:"North Tripura", block:"Panisagar",
                     lat:24.11, lng:92.20 },
                   { id:2, place:"Dharmanagar", district:"North Tripura", block:"Dharmanagar",
                     lat:24.37, lng:92.17 },
                   { id:3, place:"Agartala", district:"West Tripura", block:"Sadar",
                     lat:23.83, lng:91.28 },
                 ]
               : u.includes("my_referrals") ? [{ code:"Y7RWHJ", invited:3, published:1,
                                                 earned_paise:300 }]
               : u.includes("apply_referral") ? [{ ok:false, reason:"no_code",
                                                   referrer_name:null }]
               : u.includes("wallet_balance") ? 800
               : u.includes("wallet_history") ? [
                   { id:"e0", amount_paise:300, kind:"referral", note:"For Bikash Das",
                     created_at: new Date().toISOString() },
                   { id:"e1", amount_paise:500, kind:"signup_bonus", note:"Welcome bonus",
                     created_at: new Date().toISOString() },
                 ]
               : u.includes("services_me") ? [{ account_id: "acc-1", phone: "919862012345",
                                                full_name: "Liton Nath", is_admin: admin }]
               : u.includes("services_my_listing") ? (listing ? [{
                   id: "w1", full_name: "Bikash Das", business_name: null,
                   phone: "919862012345", trade_slug: "t1-0", trade_name: "Drivers job 1",
                   other_trades: ["t0-1"], years_experience: 6,
                   day_rate_min: 700, day_rate_max: 900,
                   locality: "Krishnanagar", city: "Agartala", state: "Tripura",
                   about: "Brick, plaster and tile work.",
                   photos: [], available: true, verified: false, status: "pending",
                   has_id_doc: false, contact_views: 4, avatar_url: null,
                   vehicle_number: null, requires_vehicle: true, requires_id: true,
                   city_id: null, district: null, loc_source: null,
                   gaps: ["vehicle_number", "id_doc"],
                   created_at: new Date().toISOString(),
                 }] : [])
               : [];
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 400, contentType: "application/json", body: "{}" }));
  await page.addInitScript(({ l, s, a }) => {
    try {
      localStorage.setItem("services_lang", l);
      localStorage.setItem("dhundo_geo_tried", "1");
      localStorage.setItem("dhundo_place", JSON.stringify({ area: "Krishnanagar", state: "Tripura" }));
      if (s) localStorage.setItem("dhundo_session", JSON.stringify({
        user: { id: "acc-1", phone: "919862012345", full_name: "Liton Nath", is_admin: a },
        access_token: "test", refresh_token: "test",
        expires_at: Date.now() + 3600000,
      }));
    } catch (e) {}
  }, { l: lang || "en", s: signedIn, a: admin });
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  if (go) await go(page);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: !go });
  await ctx.close();
  console.log("shot", name);
}

fs.mkdirSync("shots", { recursive: true });
await shot("phone-en", { width: 390, height: 844, lang: "en" });
await shot("phone-bn", { width: 360, height: 800, lang: "bn" });
await shot("phone-hi", { width: 390, height: 844, lang: "hi" });
await shot("desktop",  { width: 1100, height: 900, lang: "en" });
await shot("location", { width: 390, height: 844, lang: "en",
  go: (p) => p.getByText("Krishnanagar").first().click() });
await shot("auth", { width: 390, height: 844, lang: "en", signedIn: false,
  go: (p) => p.getByRole("button", { name: /Sign in/i }).first().click() });

// The listing wizard, which is the thing that was called broken. Every one
// of these runs with NO existing listing: the tab is hidden once there is one.
const wizard = async (p, steps) => {
  await p.getByText("List yourself").first().click();
  await p.waitForTimeout(250);
  if (steps >= 1) { await p.getByText("Construction").first().click(); await p.waitForTimeout(200); }
  if (steps >= 2) {
    await p.locator("button", { hasText: "Construction job 1" }).first().click();
    await p.locator("button", { hasText: "Construction job 2" }).first().click();
    await p.waitForTimeout(200);
  }
  if (steps >= 3) { await p.getByText("Next", { exact: true }).click(); await p.waitForTimeout(250); }
  if (steps >= 4) {
    await p.locator("input").first().fill("Rahim Mia");
    await p.getByText("Next", { exact: true }).click();
    await p.waitForTimeout(250);
  }
};
for (const [name, steps] of [
  ["form-1", 0], ["form-1b", 1], ["form-1c", 2], ["form-2", 3], ["form-3", 4],
]) {
  await shot(name, { width: 390, height: 844, lang: "en", listing: false,
                     go: (p) => wizard(p, steps) });
}

// And the header with a listing already in place: no "List yourself" chip.
await shot("listed", { width: 390, height: 844, lang: "en" });

await shot("profile", { width: 390, height: 844, lang: "en",
  go: (p) => p.getByText("My listing").first().click() });

// The "also does" picker, which until now only offered the main trade's own
// group -- the thing a driver who also delivers could not get past.
await shot("also-does", { width: 390, height: 844, lang: "en", go: async (p) => {
  await p.getByText("My listing").first().click();
  await p.waitForTimeout(400);
  const g = p.getByText("Other work you take").first();
  await g.scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  await p.locator("button", { hasText: /^Drivers$/ }).last().click();
  await p.waitForTimeout(250);
  await g.scrollIntoViewIfNeeded();
}});

// The install sheet, where the APK is now the primary action.
await shot("install", { width: 390, height: 844, lang: "en", go: async (p) => {
  await p.getByRole("button", { name: /Install app/i }).first().click();
  await p.waitForTimeout(400);
}});

// The sign-up form, with the invite-code box.
await shot("signup-code", { width: 390, height: 844, lang: "en", signedIn: false,
  go: async (p) => {
    await p.getByRole("button", { name: /Sign in/i }).first().click();
    await p.waitForTimeout(350);
    await p.getByRole("button", { name: "Create account" }).click();
    await p.waitForTimeout(400);
  }});

// The wallet, and the withdraw stub inside it.
await shot("wallet", { width: 390, height: 844, lang: "en", go: async (p) => {
  await p.getByText("\u20b98", { exact: true }).first().click();
  await p.waitForTimeout(400);
}});
await shot("wallet-withdraw", { width: 390, height: 844, lang: "en", go: async (p) => {
  await p.getByText("\u20b98", { exact: true }).first().click();
  await p.waitForTimeout(400);
  await p.getByText("Withdraw money").click();
  await p.waitForTimeout(300);
}});
await shot("wallet-bn", { width: 360, height: 800, lang: "bn", go: async (p) => {
  await p.getByText("\u20b98", { exact: true }).first().click();
  await p.waitForTimeout(400);
}});

// The driver's plate field in the wizard, and the blocking to-do list.
await shot("form-vehicle", { width: 390, height: 844, lang: "en", listing: false,
  go: async (p) => {
    await p.getByText("List yourself").first().click();
    await p.waitForTimeout(250);
    await p.getByText("Drivers", { exact: true }).first().click();
    await p.waitForTimeout(200);
    await p.locator("button", { hasText: "Drivers job 1" }).first().click();
    await p.getByText("Next", { exact: true }).click();
    await p.waitForTimeout(250);
    await p.locator("input").first().fill("Rahim Mia");
    await p.getByText("Next", { exact: true }).click();
    await p.waitForTimeout(300);
  }});

// City chosen from a list, district shown back, para typed underneath.
await shot("form-city", { width: 390, height: 844, lang: "en", listing: false,
  go: async (p) => {
    await p.getByText("List yourself").first().click();
    await p.waitForTimeout(250);
    await p.getByText("Construction").first().click();
    await p.waitForTimeout(200);
    await p.locator("button", { hasText: "Construction job 1" }).first().click();
    await p.getByText("Next", { exact: true }).click();
    await p.waitForTimeout(300);
    await p.getByText("Choose your town").click();
    await p.waitForTimeout(400);
    await p.locator("button", { hasText: "Panisagar" }).first().click();
    await p.waitForTimeout(300);
    await p.getByPlaceholder("Type your area or village").fill("Tilthai");
    await p.waitForTimeout(300);
  }});

// The typed area box in the wizard, with suggestions showing.
await shot("form-area", { width: 390, height: 844, lang: "en", listing: false,
  go: async (p) => {
    await p.getByText("List yourself").first().click();
    await p.waitForTimeout(250);
    await p.getByText("Construction").first().click();
    await p.waitForTimeout(200);
    await p.locator("button", { hasText: "Construction job 1" }).first().click();
    await p.getByText("Next", { exact: true }).click();
    await p.waitForTimeout(300);
    await p.getByPlaceholder("Type your area or village").fill("Krishn");
    await p.waitForTimeout(400);
  }});

// The admin review sheet -- the whole record before publishing.
await shot("admin-review", { width: 390, height: 844, lang: "en", admin: true,
  go: async (p) => {
    await p.getByText("Manage").first().click();
    await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Review" }).first().click();
    await p.waitForTimeout(500);
  }});

// The delete confirmation, from the worker's own page.
await shot("confirm-delete", { width: 390, height: 844, lang: "en", go: async (p) => {
  await p.getByText("My listing").first().click();
  await p.waitForTimeout(500);
  const b = p.getByText("Delete my listing").first();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await p.waitForTimeout(350);
}});

// The hide-with-a-reason box, and the account delete beneath it.
await shot("admin-hide", { width: 390, height: 844, lang: "en", admin: true,
  go: async (p) => {
    await p.getByText("Manage").first().click();
    await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Review" }).first().click();
    await p.waitForTimeout(500);
    // Scoped to the dialog: an unscoped "Hide" matches the row button in
    // the list BEHIND the sheet, which is earlier in the DOM -- and with
    // force:true it happily clicked straight through the overlay.
    const h = p.locator('[role="dialog"]').getByRole("button", { name: "Hide" }).first();
    await h.scrollIntoViewIfNeeded();
    await p.waitForTimeout(200);
    // force: the sheet is a scrolling container and Playwright kept waiting
    // for the button to be "stable" while it settled.
    await h.click({ force: true });
    await p.waitForTimeout(400);
    await p.getByPlaceholder(/The person will read this/).fill(
      "The photos are of someone else. Please upload your own.");
    await p.waitForTimeout(250);
    await p.getByText("Hide and tell them").scrollIntoViewIfNeeded();
  }});

// The unblock control and the delete-account choice.
await shot("admin-unblock", { width: 390, height: 844, lang: "en", admin: true,
  go: async (p) => {
    await p.getByText("Manage").first().click();
    await p.waitForTimeout(400);
    await p.getByRole("button", { name: /Blocked numbers/i }).click();
    await p.waitForTimeout(300);
  }});

await shot("admin-delacct", { width: 390, height: 844, lang: "en", admin: true,
  go: async (p) => {
    await p.getByText("Manage").first().click();
    await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Review" }).first().click();
    await p.waitForTimeout(600);
    const b = p.getByText("Delete this person's account");
    await b.scrollIntoViewIfNeeded();
    await b.click();
    await p.waitForTimeout(400);
  }});

// The area picker, opened from the location sheet, with a search typed in.
await shot("area", { width: 390, height: 844, lang: "en", go: async (p) => {
  await p.getByText("Krishnanagar").first().click();
  await p.waitForTimeout(300);
  await p.getByPlaceholder("Search your area").fill("pani");
  await p.waitForTimeout(250);
}});
await shot("area-all", { width: 390, height: 844, lang: "en", go: async (p) => {
  await p.getByText("Krishnanagar").first().click();
  await p.waitForTimeout(300);
}});

// Tiles will not load here (no network), which also exercises the fallback.
await shot("map", { width: 390, height: 844, lang: "en", go: async (p) => {
  await p.getByText("My listing").first().click();
  await p.waitForTimeout(400);
  const btn = p.getByText("Set on map").first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ timeout: 15000 });
  await p.waitForTimeout(1500);
}});

await browser.close();
srv.close();

if (errors.length) {
  console.error("\nRUNTIME ERRORS:");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("no runtime errors");
