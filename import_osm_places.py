#!/usr/bin/env python3
# ===========================================================================
# import_osm_places.py -- the villages and paras GeoNames does not have.
#
#     cd ~/services-app && python3 import_osm_places.py
#
# RUN 62, 63 AND 64 FIRST, and run import_regions.py before this one.
#
# ---------------------------------------------------------------------------
# WHY A SECOND SOURCE
# ---------------------------------------------------------------------------
# The GeoNames import returned 7,949 places, but only 118 of them in Tripura
# -- against roughly 900 revenue villages, never mind paras. Haryana got
# 7,215. That skew is a property of GeoNames' India data, not of Tripura,
# and it left the one state this app is actually launching in with the worst
# coverage of the three.
#
# OpenStreetMap is the opposite: the Northeast is mapped by people who live
# there, and it carries hamlets and paras that appear in no national
# register. Overpass queries it directly -- free, no key, no account.
#
# It also brings COORDINATES, which matters more than it first appears: the
# first import loaded none, so every row was unlocated and the distance
# sorting in 63 had nothing to work from. This backfills them for rows
# already loaded as well as the new ones.
#
# ---------------------------------------------------------------------------
# WHAT IT ASKS FOR
# ---------------------------------------------------------------------------
# Every node and area in the state tagged as somewhere people live: city,
# town, village, hamlet, suburb, neighbourhood, quarter, locality,
# isolated_dwelling and farm. "hamlet" and "neighbourhood" are the two that
# matter here -- a para is almost always one or the other.
#
# Overpass is donated infrastructure. This is one query per state, run once,
# with a long timeout and a pause between them. Do not put it on a schedule.
# ===========================================================================

import json
import os
import sys
import time
import urllib.error
import urllib.request

# The ISO 3166-2 codes OSM tags Indian states with. Where ISO renamed a code
# (Chhattisgarh CT->CG, Odisha OR->OD, Telangana TG->TS, Uttarakhand UT->UK in
# 2023) both are listed, because OSM boundaries carry whichever a mapper last
# set. Every state and union territory -- must match src/states.js.
STATES = {
    "Andhra Pradesh": "AP",
    "Arunachal Pradesh": "AR",
    "Assam": "AS",
    "Bihar": "BR",
    "Chhattisgarh": "CT|CG",
    "Goa": "GA",
    "Gujarat": "GJ",
    "Haryana": "HR",
    "Himachal Pradesh": "HP",
    "Jharkhand": "JH",
    "Karnataka": "KA",
    "Kerala": "KL",
    "Madhya Pradesh": "MP",
    "Maharashtra": "MH",
    "Manipur": "MN",
    "Meghalaya": "ML",
    "Mizoram": "MZ",
    "Nagaland": "NL",
    "Odisha": "OR|OD",
    "Punjab": "PB",
    "Rajasthan": "RJ",
    "Sikkim": "SK",
    "Tamil Nadu": "TN",
    "Telangana": "TG|TS",
    "Tripura": "TR",
    "Uttar Pradesh": "UP",
    "Uttarakhand": "UT|UK",
    "West Bengal": "WB",
    "Andaman and Nicobar Islands": "AN",
    "Chandigarh": "CH",
    "Dadra and Nagar Haveli and Daman and Diu": "DH|DN|DD",
    "Delhi": "DL",
    "Jammu and Kashmir": "JK",
    "Ladakh": "LA",
    "Lakshadweep": "LD",
    "Puducherry": "PY",
}

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",   # mirror, if the first is busy
]

PLACE_TYPES = ("city|town|village|hamlet|suburb|neighbourhood|quarter|"
               "locality|isolated_dwelling|farm")

KIND = {
    "city": "city", "town": "town", "village": "village", "hamlet": "village",
    "suburb": "locality", "neighbourhood": "para", "quarter": "para",
    "locality": "locality", "isolated_dwelling": "para", "farm": "para",
}

BATCH = 500


def overpass(state_iso):
    q = f"""
[out:json][timeout:900][maxsize:1073741824];
area["ISO3166-2"~"^IN-({state_iso})$"][admin_level=4]->.a;
(
  node(area.a)["place"~"^({PLACE_TYPES})$"];
  way(area.a)["place"~"^({PLACE_TYPES})$"];
  relation(area.a)["place"~"^({PLACE_TYPES})$"];
);
out center tags;
"""
    last = None
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(
                url, data=q.encode(),
                headers={"User-Agent": "dhundo-import/1.0 (services.shortlistone.com)"},
                method="POST")
            with urllib.request.urlopen(req, timeout=960) as r:
                return json.loads(r.read())
        except Exception as e:
            last = e
            print(f"    {url.split('/')[2]} failed ({e}); trying the next one", flush=True)
            time.sleep(3)
    # RuntimeError, not SystemExit: one busy state should not end the run.
    raise RuntimeError(f"both Overpass endpoints failed: {last}")


def collect(state, iso):
    print(f"  querying {state} …", flush=True)
    data = overpass(iso)
    rows, seen = [], set()
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        # The local-language name is kept only if there is no English one --
        # the rest of the app searches in Latin script.
        name = tags.get("name:en") or tags.get("name")
        if not name:
            continue
        key = name.strip().lower()
        if key in seen:
            continue
        seen.add(key)

        if el.get("type") == "node":
            lat, lng = el.get("lat"), el.get("lon")
        else:
            c = el.get("center") or {}
            lat, lng = c.get("lat"), c.get("lon")

        rows.append({
            "state": state,
            # Overpass does not give the district without a much heavier
            # query. is_in is unreliable and a second lookup per place would
            # be thousands of requests against donated infrastructure.
            "district": tags.get("is_in:district") or None,
            "block": None,
            "place": name.strip(),
            "kind": KIND.get(tags.get("place", ""), "village"),
            "source": "osm",
            "lat": lat,
            "lng": lng,
        })
    print(f"    {len(rows):,} places", flush=True)
    return rows


def post(url, key, fn, payload):
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/{fn}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "apikey": key,
                 "Authorization": f"Bearer {key}"},
        method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or "null")


def count_of(res, field):
    if isinstance(res, list) and res:
        return res[0].get(field, 0) or 0
    if isinstance(res, dict):
        return res.get(field, 0) or 0
    return 0


def main():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not url:
        try:
            import re
            cfg = open("src/config.js", encoding="utf-8").read()
            url = re.search(r'SUPABASE_URL\s*=\s*"([^"]+)"', cfg).group(1).rstrip("/")
            print(f"  using {url} from src/config.js")
        except Exception:
            print("Set SUPABASE_URL, or run this from inside ~/services-app.")
            sys.exit(1)

    if not key:
        import getpass
        key = getpass.getpass("Supabase SERVICE ROLE key (input hidden): ").strip()
    if not key:
        print("No key given.")
        sys.exit(1)

    # All of India by default, or only the states named on the command line:
    #     python3 import_osm_places.py "West Bengal" Assam
    wanted = sys.argv[1:] or list(STATES)
    unknown = [w for w in wanted if w not in STATES]
    if unknown:
        print("Not a state this app knows: " + ", ".join(unknown))
        sys.exit(1)

    print(f"\nAsking OpenStreetMap about {len(wanted)} state(s). "
          "Small states take a minute, Uttar Pradesh or Maharashtra much longer.\n")

    # Uploaded state by state rather than all at the end: the whole country
    # is far too many rows to hold at once, and a failure halfway through
    # should not throw away the states that already worked.
    added = fixed = 0
    by_state = {}
    failed = []
    for state in wanted:
        try:
            rows = collect(state, STATES[state])
        except SystemExit:
            raise
        except Exception as e:
            print(f"    {state} failed: {e}")
            failed.append(state)
            time.sleep(5)
            continue
        by_state[state] = len(rows)

        for i in range(0, len(rows), BATCH):
            added += count_of(post(url, key, "services_load_regions",
                                   {"p_rows": rows[i:i + BATCH]}), "inserted")
        # Coordinates too -- this also backfills the GeoNames rows.
        located = [r for r in rows if r.get("lat") is not None]
        for i in range(0, len(located), BATCH):
            fixed += count_of(post(url, key, "services_load_region_coords",
                                   {"p_rows": located[i:i + BATCH]}), "updated")
        print(f"    loaded {state}", flush=True)
        time.sleep(5)   # Overpass is donated; do not hammer it

    if not by_state:
        print("Nothing returned.")
        sys.exit(1)
    print("\nTotal: " + ", ".join(f"{k} {v:,}" for k, v in sorted(by_state.items())))
    if failed:
        # Usually Overpass being busy or timing out on a big state. Nothing
        # already loaded is lost; run just these again later.
        print("\nThese did not load -- run them again on their own:")
        print("  python3 import_osm_places.py " + " ".join(f'"{f}"' for f in failed))

    print(f"\nDone. {added:,} new places, {fixed:,} rows given coordinates.")
    print("\nCheck it:")
    print("  select state, count(*), count(lat) as located")
    print("    from public.services_regions group by state;")
    print("  select * from public.services_search_regions('Tripura','tilthai',10);")
    print("\nThen give every listing its coordinates from its area:")
    print("  update public.services_workers set locality = locality where lat is null;")


# ---------------------------------------------------------------------------
# ATTRIBUTION
# OpenStreetMap data is ODbL. Using it is free; crediting it is required:
#
#     Place data © OpenStreetMap contributors
#
# The same line already appears on the map picker.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    main()
