// Road distance from a customer to listings, by Google Routes (distance matrix).
//
// The browser sends where the customer is and the ids of the listings in the
// result; this function looks up those listings positions itself (they never
// leave the database), asks Google for the driving distance, and returns only
// kilometres per listing id. Each call is counted against a monthly allowance
// (services_gmap_take, kind routes) so the bill cannot run away.
//
// Secrets (supabase secrets set ...): GOOGLE_ROUTES_KEY. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const key = Deno.env.get("GOOGLE_ROUTES_KEY");
    if (!key) return reply({ ok: false, reason: "not_configured" });
    const { origin, ids } = await req.json();
    if (!origin || typeof origin.lat !== "number" || typeof origin.lng !== "number"
        || !Array.isArray(ids) || !ids.length) return reply({ ok: false, reason: "bad_input" }, 400);
    const list: string[] = ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 25);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: take, error: takeErr } = await db.rpc("services_gmap_take", { p_kind: "routes" });
    if (takeErr || !take || take.ok !== true) return reply({ ok: false, reason: "allowance" });

    const { data: rows, error } = await db.from("services_workers")
      .select("id, lat, lng, loc_source").in("id", list).eq("status", "approved")
      .not("lat", "is", null).not("lng", "is", null);
    if (error || !rows || !rows.length) return reply({ ok: true, km: {}, exact: {} });

    const wp = (la: number, lo: number) => ({ waypoint: { location: { latLng: { latitude: la, longitude: lo } } } });
    const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,status,condition",
      },
      body: JSON.stringify({
        origins: [wp(origin.lat, origin.lng)],
        destinations: rows.map((r) => wp(r.lat, r.lng)),
        travelMode: "DRIVE",
      }),
    });
    if (!res.ok) return reply({ ok: false, reason: "google_" + res.status });
    const matrix = await res.json();
    const km: Record<string, number> = {};
    const exact: Record<string, boolean> = {};
    for (const m of Array.isArray(matrix) ? matrix : []) {
      if (m.condition !== "ROUTE_EXISTS" || typeof m.distanceMeters !== "number") continue;
      const r = rows[m.destinationIndex];
      if (!r) continue;
      km[r.id] = Math.round(m.distanceMeters / 100) / 10;
      exact[r.id] = r.loc_source === "device" || r.loc_source === "picked";
    }
    return reply({ ok: true, km, exact });
  } catch (_) {
    return reply({ ok: false, reason: "error" }, 500);
  }
});
