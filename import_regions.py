#!/usr/bin/env python3
# ===========================================================================
# import_regions.py -- load every village and para into services_regions.
#
#     cd ~/services-app && python3 import_regions.py
#
# RUN THIS ON THE SERVER. It needs to reach geonames.org and your Supabase
# project, which the Contabo box can do and a laptop behind a corporate
# proxy may not.
#
# ---------------------------------------------------------------------------
# WHERE THE DATA COMES FROM
# ---------------------------------------------------------------------------
# GeoNames' India extract (IN.zip): a free, no-account, no-key dump of every
# populated place in the country -- cities, towns, villages, hamlets and
# "sections of populated place", which is what a para usually is. CC-BY 4.0,
# so it can be used commercially with attribution; see ATTRIBUTION at the
# bottom of this file for the line that has to appear somewhere in the app.
#
# State and district names are resolved from GeoNames' own code tables
# rather than from a hardcoded mapping. India's admin1 codes are numeric
# ("IN.26" is Tripura) and I am not willing to bet your data on my
# remembering which number is which -- so the script downloads the table and
# looks it up.
#
# ---------------------------------------------------------------------------
# WHAT IT WILL NOT DO
# ---------------------------------------------------------------------------
# It will not give you a complete list of paras. No national dataset has
# every para in Tripura -- some exist only in local usage and appear in no
# register anywhere. That is what services_add_region() is for: when somebody
# says their para is missing, you add it and every later search finds it.
# This script gets you the several thousand that ARE recorded, which is the
# difference between a location field that usually works and one that
# usually does not.
# ===========================================================================

import io
import json
import os
import sys
import urllib.request
import zipfile

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

GEONAMES = "https://download.geonames.org/export/dump/"
ADMIN1 = GEONAMES + "admin1CodesASCII.txt"
ADMIN2 = GEONAMES + "admin2Codes.txt"
COUNTRY = GEONAMES + "IN.zip"

# GeoNames feature codes, class P. Everything here is somewhere people live.
# PPLX ("section of populated place") is the important one: that is the para,
# the colony, the mohalla -- the level the earlier attempts were missing.
KIND_BY_CODE = {
    "PPLC": "city", "PPLA": "city", "PPLA2": "city", "PPLA3": "town",
    "PPLA4": "town", "PPL": "village", "PPLL": "village", "PPLS": "village",
    "PPLX": "para", "PPLF": "village", "PPLR": "village", "PPLW": "village",
    "PPLQ": "village", "PPLH": "village",
}

# GeoNames files most Indian towns as plain PPL, the same code as a hamlet,
# so the feature code alone would leave the town picker nearly empty outside
# the district headquarters. Its population column tells them apart: ten
# thousand people is roughly where India's census starts calling a place a
# town. Only upgrades -- a PPLA is a city whatever its recorded population.
TOWN_POPULATION = 10000


def kind_of(fcode, population):
    kind = KIND_BY_CODE.get(fcode, "village")
    if kind == "village":
        try:
            if int(population or 0) >= TOWN_POPULATION:
                return "town"
        except ValueError:
            pass
    return kind


BATCH = 500


def fetch(url):
    print(f"  downloading {url.rsplit('/', 1)[-1]} …", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "dhundo-import/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def load_admin_names():
    """{'IN.26': 'Tripura'} and {'IN.26.xx': 'North Tripura'}."""
    a1, a2 = {}, {}
    for line in fetch(ADMIN1).decode("utf-8", "replace").splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[0].startswith("IN."):
            a1[parts[0]] = parts[1]
    for line in fetch(ADMIN2).decode("utf-8", "replace").splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[0].startswith("IN."):
            a2[parts[0]] = parts[1]
    return a1, a2


def load_places(a1, a2):
    raw = fetch(COUNTRY)
    rows = []
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        with z.open("IN.txt") as fh:
            for line in io.TextIOWrapper(fh, encoding="utf-8", errors="replace"):
                f = line.rstrip("\n").split("\t")
                if len(f) < 15:
                    continue
                name, fclass, fcode = f[1], f[6], f[7]
                admin1, admin2 = f[10], f[11]
                if fclass != "P" or not name:
                    continue
                state = a1.get(f"IN.{admin1}")
                state = STATE_ALIASES.get(state, state)
                if state not in STATES:
                    continue
                district = a2.get(f"IN.{admin1}.{admin2}") if admin2 else None
                rows.append({
                    "state": state,
                    "district": district,
                    "block": None,     # GeoNames has no block level for India
                    "place": name,
                    "kind": kind_of(fcode, f[14]),
                    "source": "geonames",
                })
    return rows


def post_batch(url, key, rows):
    body = json.dumps({"p_rows": rows}).encode()
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/services_load_regions",
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
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not url:
        # Read it out of the app's own config rather than asking twice.
        try:
            import re
            cfg = open("src/config.js", encoding="utf-8").read()
            url = re.search(r'SUPABASE_URL\s*=\s*"([^"]+)"', cfg).group(1).rstrip("/")
            print(f"  using {url} from src/config.js")
        except Exception:
            print("Set SUPABASE_URL, or run this from inside ~/services-app.")
            sys.exit(1)

    if not key:
        # The SERVICE ROLE key, not the anon key: services_load_regions is
        # deliberately not granted to anon or authenticated. It is read
        # without echo and never written anywhere -- not to a file, not to
        # your shell history, not to the console.
        import getpass
        key = getpass.getpass("Supabase SERVICE ROLE key (input hidden): ").strip()
    if not key:
        print("No key given.")
        sys.exit(1)

    print("Reading GeoNames …")
    a1, a2 = load_admin_names()
    rows = load_places(a1, a2)

    by_state = {}
    for r in rows:
        by_state[r["state"]] = by_state.get(r["state"], 0) + 1
    print(f"\nFound {len(rows):,} places: " +
          ", ".join(f"{k} {v:,}" for k, v in sorted(by_state.items())))

    if not rows:
        print("Nothing to load — check that the download succeeded.")
        sys.exit(1)

    print("\nLoading …")
    total = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        try:
            res = post_batch(url, key, chunk)
        except Exception as e:
            print(f"  batch {i // BATCH + 1} failed: {e}")
            print("  (a 401 here means the key was the anon key, not the service role key)")
            sys.exit(1)
        n = 0
        if isinstance(res, list) and res:
            n = res[0].get("inserted", 0) or 0
        elif isinstance(res, dict):
            n = res.get("inserted", 0) or 0
        total += n
        print(f"  {min(i + BATCH, len(rows)):,} / {len(rows):,}  (+{n})", flush=True)

    print(f"\nDone. {total:,} new rows.")
    print("Duplicates are skipped, so running this again is safe.")
    print("\nCheck it worked:")
    print("  select count(*), state from public.services_regions group by state;")
    print("  select * from public.services_search_regions('Tripura','tilthai',10);")


# ---------------------------------------------------------------------------
# ATTRIBUTION
# GeoNames data is CC-BY 4.0. Using it commercially is fine; crediting it is
# a condition, not a courtesy. A line in the app footer or an about page is
# enough:
#
#     Place data © GeoNames, CC BY 4.0
#
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    main()
