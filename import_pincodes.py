#!/usr/bin/env python3
# ===========================================================================
# import_pincodes.py -- load Indian pincodes, with coordinates, into
#                       services_pincodes.
#
#     cd ~/services-app && python3 import_pincodes.py
#
# RUN THIS ON THE SERVER, for the same reason as import_regions.py: it needs
# to reach geonames.org and your Supabase project.
#
# ---------------------------------------------------------------------------
# WHY THIS SOURCE AND NOT A PINCODE API
# ---------------------------------------------------------------------------
# India has a free pincode API -- postalpincode.in, no key, no signup -- and
# it is genuinely useful: it returns the post office, the district and the
# state. It does NOT return latitude and longitude, which is precisely the
# half the app cannot work out for itself. A district is a label; a
# coordinate is what "4 km away" is computed from.
#
# GeoNames' postal export does carry coordinates. Columns, tab separated:
#
#   1 country  2 postal_code  3 place_name  4 admin_name1 (state)
#   5 admin_code1  6 admin_name2 (district)  7 admin_code2
#   8 admin_name3  9 admin_code3  10 LATITUDE  11 LONGITUDE  12 accuracy
#
# It is a file, downloaded once. That means no per-listing network call, no
# rate limit, and nothing that can be down at the moment somebody is signing
# up on a village 3G connection. Licence is CC-BY 4.0, same as the places
# import -- the attribution line at the bottom of import_regions.py covers
# both.
#
# ---------------------------------------------------------------------------
# HOW COMPLETE IS IT? THIS SCRIPT TELLS YOU RATHER THAN PROMISING.
# ---------------------------------------------------------------------------
# GeoNames' postal coverage varies a lot by country, and India's is not
# uniform across states. The places import already showed this the hard way:
# Tripura had 118 rows against Haryana's 7,215. So before uploading anything,
# this prints a count per state and how many of those rows actually carry
# coordinates. If Tripura comes back with a handful, you will know
# immediately rather than discovering it through listings that will not sort
# by distance.
#
# If the coverage is poor, there is a fallback that needs no code change:
#   --csv FILE  loads a CSV with columns pincode,place,district,state,lat,lng
# so a better dataset (data.gov.in publishes an All-India pincode directory)
# can be dropped in without touching this script's logic.
# ===========================================================================

import argparse
import csv
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict

# Every state and union territory -- must match src/states.js.
STATES = {
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
}

# What GeoNames and India Post call some states instead of the app's name.
# Anything not listed passes through unchanged.
STATE_ALIASES = {
    "NCT": "Delhi",
    "National Capital Territory of Delhi": "Delhi",
    "NCT of Delhi": "Delhi",
    "New Delhi": "Delhi",
    "Orissa": "Odisha",
    "Pondicherry": "Puducherry",
    "Uttaranchal": "Uttarakhand",
    "Andaman and Nicobar": "Andaman and Nicobar Islands",
    "Andaman & Nicobar Islands": "Andaman and Nicobar Islands",
    "Andaman & Nicobar": "Andaman and Nicobar Islands",
    "Jammu & Kashmir": "Jammu and Kashmir",
    "Dadra and Nagar Haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "Daman and Diu": "Dadra and Nagar Haveli and Daman and Diu",
    "Dadra & Nagar Haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "Daman & Diu": "Dadra and Nagar Haveli and Daman and Diu",
    "Chattisgarh": "Chhattisgarh",
    "Telengana": "Telangana",
}

POSTAL_ZIP = "https://download.geonames.org/export/zip/IN.zip"
BATCH = 500


def fetch(url):
    print(f"  downloading {url.rsplit('/', 1)[-1]} …", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "dhundo-import/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def rows_from_geonames():
    raw = fetch(POSTAL_ZIP)
    rows = []
    skipped_states = defaultdict(int)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        name = "IN.txt" if "IN.txt" in z.namelist() else z.namelist()[0]
        with z.open(name) as fh:
            for line in io.TextIOWrapper(fh, encoding="utf-8", errors="replace"):
                f = line.rstrip("\n").split("\t")
                if len(f) < 11:
                    continue
                pincode = (f[1] or "").strip()
                place = (f[2] or "").strip() or None
                raw_state = (f[3] or "").strip()
                district = (f[5] or "").strip() or None
                lat = (f[9] or "").strip()
                lng = (f[10] or "").strip()

                state = STATE_ALIASES.get(raw_state, raw_state)
                if state not in STATES:
                    if raw_state:
                        skipped_states[raw_state] += 1
                    continue
                if not (pincode.isdigit() and len(pincode) == 6 and pincode[0] != "0"):
                    continue
                rows.append({
                    "pincode": pincode,
                    "place": place,
                    "district": district,
                    "state": state,
                    "lat": lat or None,
                    "lng": lng or None,
                    "source": "geonames",
                })
    return rows, skipped_states


def rows_from_csv(path):
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            low = {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
            pincode = low.get("pincode") or low.get("pin") or ""
            # Same rule as the table's CHECK constraint, applied here so the
            # counts printed below are the counts that will actually load.
            if not (pincode.isdigit() and len(pincode) == 6 and pincode[0] != "0"):
                continue
            rows.append({
                "pincode": pincode,
                "place": low.get("place") or low.get("office") or None,
                "district": low.get("district") or None,
                "state": low.get("state") or None,
                "lat": low.get("lat") or low.get("latitude") or None,
                "lng": low.get("lng") or low.get("longitude") or None,
                "source": "csv",
            })
    return rows


def merge_by_pincode(rows):
    """One row per PIN code.

    The source lists every POST OFFICE, and one PIN code usually covers
    several (155k offices, about 19k PIN codes). services_pincodes is keyed
    on the PIN code, and Postgres refuses to upsert the same key twice in
    one statement -- which is what a batch containing two offices of one
    PIN code asks it to do, and why the upload died with an HTTP 500.

    Kept: the first office's name, district and state (the head office is
    usually listed first), and the average of the offices' coordinates,
    which is closer to the middle of the area than any single office.
    """
    merged = {}
    sums = {}
    for r in rows:
        pin = r["pincode"]
        if pin not in merged:
            merged[pin] = dict(r)
            sums[pin] = [0.0, 0.0, 0]
        try:
            lat, lng = float(r["lat"]), float(r["lng"])
        except (TypeError, ValueError):
            continue
        s = sums[pin]
        s[0] += lat; s[1] += lng; s[2] += 1
    for pin, row in merged.items():
        lat, lng, n = sums[pin]
        if n:
            row["lat"], row["lng"] = round(lat / n, 6), round(lng / n, 6)
        else:
            row["lat"] = row["lng"] = None
    return list(merged.values())


def fix_ladakh(rows):
    """Ladakh became its own union territory in 2019; GeoNames still files it
    under Jammu and Kashmir. Its PIN codes are the 194 series (Leh and
    Kargil), so those are moved across."""
    for r in rows:
        if r["pincode"].startswith("194") and r["state"] == "Jammu and Kashmir":
            r["state"] = "Ladakh"
    return rows


# ---------------------------------------------------------------------------
# POST OFFICES AS PLACES  (--places)
#
# The same file names every post office in India -- about 155,000, with
# coordinates -- and nearly every village and urban locality has one. For
# the states the gazetteers cover thinly (Tripura, Assam, West Bengal) that
# is the most complete list of place names available anywhere.
#
# The office-type suffix says what kind of place it is:
#   B.O  branch office  -> almost always a village
#   S.O  sub office     -> a town or an urban locality
#   H.O  head office    -> a town (usually a district headquarters)
# ---------------------------------------------------------------------------
import re

OFFICE_SUFFIX = re.compile(
    r"\s*[\(\[]?\b(?:G\.?\s?P\.?\s?O|H\.?\s?O|S\.?\s?O|B\.?\s?O|E\.?\s?D\.?\s?S\.?\s?O|P\.?\s?O)\b\.?[\)\]]?\s*$",
    re.IGNORECASE)


def office_kind(raw):
    tail = raw.replace(".", "").replace(" ", "").upper()
    if tail.endswith("BO"):
        return "village"
    if tail.endswith("HO") or tail.endswith("GPO"):
        return "town"
    return "locality"


def clean_office_name(raw):
    name = OFFICE_SUFFIX.sub("", raw or "").strip(" -,.")
    return re.sub(r"\s+", " ", name)


def office_places(rows):
    """One place per (state, name), from the raw post-office rows."""
    out, seen = [], set()
    for r in rows:
        raw = r.get("place") or ""
        name = clean_office_name(raw)
        if len(name) < 2 or not r.get("state"):
            continue
        k = (r["state"], name.lower())
        if k in seen:
            continue
        seen.add(k)
        try:
            lat, lng = float(r["lat"]), float(r["lng"])
        except (TypeError, ValueError):
            lat = lng = None
        out.append({
            "state": r["state"], "district": r.get("district"), "block": None,
            "place": name, "kind": office_kind(raw), "source": "post",
            "lat": lat, "lng": lng,
        })
    return out


def load_office_places(url, key, places):
    from import_osm_places import post, count_of   # same loaders as the OSM import

    skipped = []

    def send(rows, depth=0):
        """Load rows; on a refusal retry once, then halve until the rows the
        database objects to are isolated. Those are skipped and reported;
        everything else loads."""
        try:
            return count_of(post(url, key, "services_load_regions", {"p_rows": rows}), "inserted")
        except urllib.error.HTTPError as e:
            if depth == 0:
                print(f"\n  a batch was refused ({e}); retrying", flush=True)
                time.sleep(5)
                try:
                    return count_of(post(url, key, "services_load_regions",
                                         {"p_rows": rows}), "inserted")
                except urllib.error.HTTPError:
                    pass
            if len(rows) == 1:
                skipped.append((rows[0]["state"], rows[0]["place"], str(e)[:160]))
                return 0
            mid = len(rows) // 2
            return send(rows[:mid], depth + 1) + send(rows[mid:], depth + 1)

    added = located = 0
    for i in range(0, len(places), BATCH):
        chunk = places[i:i + BATCH]
        added += send(chunk)
        with_coords = [p for p in chunk if p["lat"] is not None]
        if with_coords:
            try:
                located += count_of(post(url, key, "services_load_region_coords",
                                         {"p_rows": with_coords}), "updated")
            except urllib.error.HTTPError as e:
                print(f"\n  coordinates for one batch not saved ({e})", flush=True)
        print(f"  {min(i + BATCH, len(places)):,} / {len(places):,}", end="\r", flush=True)

    print(f"\n  Done. {added:,} new places from post offices, "
          f"{located:,} rows given coordinates.")
    if skipped:
        print(f"\n  {len(skipped)} place(s) the database refused -- send these over:")
        for st, name, why in skipped[:20]:
            print(f"    {st}: {name!r}  ({why})")
    print("\n  Check it:")
    print("    select state, count(*) from public.services_regions "
          "group by state order by 2;")


def report(rows):
    """What is actually in hand, before anything is uploaded."""
    per_state = defaultdict(lambda: [0, 0])
    for r in rows:
        st = r["state"] or "?"
        per_state[st][0] += 1
        if r["lat"] and r["lng"]:
            per_state[st][1] += 1

    print("\n  PINCODES FOUND")
    print("  " + "-" * 44)
    print(f"  {'state':<16}{'rows':>8}{'with coords':>16}")
    for st in sorted(per_state):
        n, c = per_state[st]
        print(f"  {st:<16}{n:>8}{c:>16}")
    print("  " + "-" * 44)
    total = sum(v[0] for v in per_state.values())
    coords = sum(v[1] for v in per_state.values())
    print(f"  {'TOTAL':<16}{total:>8}{coords:>16}\n")

    for st in sorted(STATES):
        if per_state.get(st, [0, 0])[1] == 0:
            print(f"  WARNING: no coordinates for {st}. Distance sorting will "
                  f"fall back to the city centre for anyone there.")
    return total, coords


def post_batch(url, key, rows):
    body = json.dumps({"p_rows": rows}).encode()
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/services_load_pincodes",
        data=body,
        headers={
            "Content-Type": "application/json",
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or "null")


# ---------------------------------------------------------------------------
# POST OFFICES WITH THEIR PIN CODES  (--offices)
#
# One row per post office: its name as written ("Tilthai Nutanbazar B.O"),
# the name cleaned of the office type, its PIN, district and state. This is
# the exact part of the postal data -- which office belongs to which PIN --
# where the PIN centre positions are only rough.
# ---------------------------------------------------------------------------
def load_post_offices(rows, dry_run):
    offices, seen = [], set()
    for r in fix_ladakh(rows):
        raw = (r.get("place") or "").strip()
        name = clean_office_name(raw)
        if len(name) < 2 or not r.get("state"):
            continue
        k = (r["state"], raw, r["pincode"])
        if k in seen:
            continue
        seen.add(k)
        offices.append({"pincode": r["pincode"], "office": raw, "name": name,
                        "district": r.get("district") or "", "state": r["state"]})
    per = defaultdict(int)
    for o in offices:
        per[o["state"]] += 1
    print(f"\n  {len(offices):,} post offices with their PIN codes")
    for st in sorted(per):
        print(f"    {st:<42} {per[st]:>7,}")
    if dry_run:
        print("  --dry-run: nothing uploaded.")
        return 0

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("\n  Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.")
        return 1
    url = url.rstrip("/")

    loaded = 0
    for i in range(0, len(offices), BATCH):
        chunk = offices[i:i + BATCH]
        body = json.dumps({"p_rows": chunk}).encode()
        req = urllib.request.Request(
            f"{url}/rest/v1/rpc/services_load_post_offices", data=body, method="POST",
            headers={"apikey": key, "Authorization": f"Bearer {key}",
                     "Content-Type": "application/json"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=120) as res:
                    out = json.loads(res.read() or b"[]")
                    loaded += (out[0] or {}).get("loaded", 0) if isinstance(out, list) and out else 0
                break
            except urllib.error.HTTPError as e:
                if e.code < 500 or attempt == 3:
                    print(f"\n  batch {i // BATCH + 1} refused: {e.code} {e.read()[:300]!r}")
                    return 1
            except urllib.error.URLError as e:
                if attempt == 3:
                    print(f"\n  Could not reach {url}  ({e.reason})")
                    print("  Check SUPABASE_URL: Supabase > Project Settings > API > Project URL,")
                    print("  like https://abcdefghijklmnop.supabase.co")
                    return 1
            time.sleep(2 ** attempt)
        print(f"  {min(i + BATCH, len(offices)):,} / {len(offices):,}", end="\r", flush=True)
    print(f"\n  Done. {loaded:,} post offices loaded.")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="load from a CSV instead of GeoNames")
    ap.add_argument("--dry-run", action="store_true",
                    help="report coverage and upload nothing")
    ap.add_argument("--places", action="store_true",
                    help="load every post office as a PLACE (village or "
                         "locality) instead of loading PIN codes")
    ap.add_argument("--offices", action="store_true",
                    help="load every post office WITH ITS PIN CODE (needs "
                         "sql/92), so a village finds its own PIN by name")
    args = ap.parse_args()

    if args.csv:
        rows = rows_from_csv(args.csv)
        skipped = {}
    else:
        rows, skipped = rows_from_geonames()

    if args.offices:
        return load_post_offices(rows, args.dry_run)

    if args.places:
        places = office_places(fix_ladakh(rows))
        per = defaultdict(int)
        for p in places:
            per[p["state"]] += 1
        print(f"\n  {len(rows):,} post offices -> {len(places):,} distinct place names")
        for st in sorted(per):
            print(f"    {st:<42} {per[st]:>7,}")
        if args.dry_run:
            print("  --dry-run: nothing uploaded.")
            return 0
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            print("\n  Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.")
            return 1
        load_office_places(url.rstrip("/"), key, places)
        return 0

    offices = len(rows)
    rows = merge_by_pincode(fix_ladakh(rows))
    print(f"  {offices:,} post offices -> {len(rows):,} distinct PIN codes")

    total, coords = report(rows)
    if skipped:
        top = sorted(skipped.items(), key=lambda kv: -kv[1])[:5]
        print("  (other states in the file, not loaded: "
              + ", ".join(f"{k} {v}" for k, v in top) + ", …)\n")

    if total == 0:
        print("  Nothing to load. If GeoNames has no postal rows for these "
              "states, download a pincode CSV and re-run with --csv FILE.")
        return 1

    if args.dry_run:
        print("  --dry-run: nothing uploaded.")
        return 0

    # The service_role key, not the anon key: services_load_pincodes is
    # granted to nobody else, on purpose. Read from the environment so it
    # never lands in shell history or in this file.
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("\n  Set these first, then run again:\n"
              "    export SUPABASE_URL=https://YOURPROJECT.supabase.co\n"
              "    read -rsp 'service_role key: ' SUPABASE_SERVICE_KEY; "
              "export SUPABASE_SERVICE_KEY; echo\n"
              "  (read -rsp keeps the key out of your shell history.)")
        return 1

    sent = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        try:
            post_batch(url, key, chunk)
        except Exception as e:
            print(f"  batch at {i} failed: {e}")
            return 1
        sent += len(chunk)
        print(f"  uploaded {sent}/{len(rows)}", end="\r", flush=True)

    print(f"\n  Done. {sent} pincodes loaded, {coords} of them with coordinates.")
    print("\n  Now re-file existing listings so the new coordinates are used:")
    print("    update public.services_workers set pincode = pincode;")
    return 0


if __name__ == "__main__":
    sys.exit(main())
