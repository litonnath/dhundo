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
import urllib.request
import zipfile
from collections import defaultdict

STATES = {"Tripura", "Delhi", "Haryana"}

# GeoNames spells some state names differently from the app. Only the ones
# that actually differ are listed; anything else passes through untouched.
STATE_ALIASES = {
    "NCT": "Delhi",
    "National Capital Territory of Delhi": "Delhi",
    "Delhi": "Delhi",
    "Tripura": "Tripura",
    "Haryana": "Haryana",
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="load from a CSV instead of GeoNames")
    ap.add_argument("--dry-run", action="store_true",
                    help="report coverage and upload nothing")
    args = ap.parse_args()

    if args.csv:
        rows = rows_from_csv(args.csv)
        skipped = {}
    else:
        rows, skipped = rows_from_geonames()

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
