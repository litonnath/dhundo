#!/usr/bin/env python3
# ===========================================================================
# import_osm_file.py -- every village, hamlet and locality in India from ONE
# downloaded OpenStreetMap file, instead of thousands of Overpass queries.
#
#     cd ~/services-app && python3 import_osm_file.py
#     python3 import_osm_file.py Assam "West Bengal"     # only these states
#
# Replaces import_osm_places.py. Same data, same database functions, same
# rows -- but read from Geofabrik's daily India extract on this server, so
# there is no busy public server to time out, rate-limit or answer "nothing".
#
# ---------------------------------------------------------------------------
# ONE-TIME SETUP ON THE SERVER (Ubuntu)
# ---------------------------------------------------------------------------
#     apt-get install -y osmium-tool python3-pyosmium python3-shapely
#
# Disk: about 3 GB free in ~/osm (the India file is ~1.5 GB, plus two much
# smaller filtered copies). Memory: well under 2 GB.
# Time: download a few minutes; the rest 10-30 minutes for all of India.
#
# ---------------------------------------------------------------------------
# HOW IT WORKS
# ---------------------------------------------------------------------------
#  1. Download india-latest.osm.pbf from Geofabrik (reused if under a week
#     old -- pass --fresh to force a new one).
#  2. osmium-tool cuts two small files out of it: the state boundaries, and
#     everything tagged as a place people live.
#  3. The state boundaries become polygons; every place is put in the state
#     whose polygon contains it. A point just outside every polygon (a
#     village on a river border, say) goes to the nearest state within
#     ~20 km; anything further out is outside India and skipped.
#  4. Loaded through the same services_load_regions and
#     services_load_region_coords as before, state by state. Duplicates are
#     skipped by the database, so re-running is safe.
# ===========================================================================

import json
import os
import subprocess
import sys
import time
import urllib.request

try:
    import osmium
    import osmium.geom
    from shapely import wkb as shapely_wkb
    from shapely.geometry import Point
    from shapely.prepared import prep
except ImportError as e:
    print(f"Missing a library ({e.name}). Install once with:\n"
          "  apt-get install -y osmium-tool python3-pyosmium python3-shapely")
    sys.exit(1)

# Reuse the state table, place kinds and upload helpers of the Overpass
# importer, so the two can never disagree about what a state or a hamlet is.
from import_osm_places import STATES, KIND, BATCH, post, count_of
from import_regions import STATE_ALIASES

GEOFABRIK = "https://download.geofabrik.de/asia/india-latest.osm.pbf"
WORK = os.path.expanduser("~/osm")
PLACE_VALUES = list(KIND)   # city, town, village, hamlet, suburb, ...
NEAREST_DEGREES = 0.2       # ~20 km: how far outside a boundary still counts

# States whose boundary OpenStreetMap cannot assemble into a closed outline.
# Arunachal Pradesh's border is disputed and tagged so that the relation does
# not form a polygon in Geofabrik's extract. A place that falls in no state
# at all but inside this box is Arunachal: the box starts north of Assam
# (already tested first) and east of Bhutan's eastern edge.
#   state: (min_lat, max_lat, min_lng, max_lng)
FALLBACK_BOXES = {
    "Arunachal Pradesh": (26.6, 29.5, 91.55, 97.45),
}

# ISO code -> state, both spellings where ISO renamed one ("CT|CG").
ISO_TO_STATE = {}
for _state, _codes in STATES.items():
    for _c in _codes.split("|"):
        ISO_TO_STATE[f"IN-{_c}"] = _state
NAME_TO_STATE = {s.lower(): s for s in STATES}
NAME_TO_STATE.update({k.lower(): v for k, v in STATE_ALIASES.items()})


# --------------------------------------------------------------- download
def download(path, fresh):
    if os.path.exists(path) and not fresh:
        age_days = (time.time() - os.path.getmtime(path)) / 86400
        if age_days < 7:
            print(f"  using {path} ({age_days:.1f} days old)")
            return
    print(f"  downloading {GEOFABRIK}")
    tmp = path + ".part"
    req = urllib.request.Request(GEOFABRIK, headers={"User-Agent": "dhundo-import/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as out:
        total = int(r.headers.get("Content-Length") or 0)
        got, last = 0, 0
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
            got += len(chunk)
            if got - last >= 50 << 20:
                last = got
                pct = f" ({got * 100 // total}%)" if total else ""
                print(f"    {got >> 20:,} MB{pct}", flush=True)
    if total and got != total:
        raise SystemExit(f"Download incomplete ({got:,} of {total:,} bytes). Run again.")
    os.replace(tmp, path)
    print(f"  saved {got >> 20:,} MB")


def osmium_filter(src, dst, expression):
    subprocess.run(["osmium", "tags-filter", src, *expression.split(),
                    "-o", dst, "--overwrite", "--no-progress"], check=True)


# ------------------------------------------------------------ state areas
class StateAreas(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.wkb = osmium.geom.WKBFactory()
        self.found = {}   # state -> shapely geometry

    def area(self, a):
        if a.from_way():
            return
        tags = a.tags
        if tags.get("admin_level") != "4":
            return
        state = ISO_TO_STATE.get(tags.get("ISO3166-2", ""))
        if not state:
            for key in ("name:en", "name"):
                state = NAME_TO_STATE.get((tags.get(key) or "").strip().lower())
                if state:
                    break
        if not state:
            return
        try:
            geom = shapely_wkb.loads(self.wkb.create_multipolygon(a), hex=True)
        except Exception:
            return   # a broken boundary; its places fall back to "nearest"
        old = self.found.get(state)
        self.found[state] = geom if old is None else old.union(geom)


# ----------------------------------------------------------------- places
class Places(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = []   # (name, place, lat, lng)

    def _keep(self, tags, lat, lng):
        place = tags.get("place")
        if place not in KIND:
            return
        # The English name if there is one: the app searches in Latin script.
        name = (tags.get("name:en") or tags.get("name") or "").strip()
        if name:
            self.rows.append((name, place, lat, lng))

    def node(self, n):
        if n.location.valid():
            self._keep(n.tags, n.location.lat, n.location.lon)

    def way(self, w):
        # Middle of the way's points: good enough to sort by distance.
        lat = lng = 0.0
        k = 0
        for nd in w.nodes:
            if nd.location.valid():
                lat += nd.location.lat
                lng += nd.location.lon
                k += 1
        if k:
            self._keep(w.tags, lat / k, lng / k)


# ------------------------------------------------------ point in a state
class Locator:
    """Which state a point is in. Bounding boxes first, so each point is
    tested against the two or three states near it, not all thirty-six."""

    def __init__(self, areas):
        # The "nearest state" fallback measures against a simplified outline
        # (~1 km tolerance): exact enough for 20 km, and far faster than a
        # boundary with tens of thousands of points.
        self.items = [(s, g.bounds, prep(g), g.simplify(0.01))
                      for s, g in areas.items()]
        # Only for states that really had no boundary this time.
        self.fallback = [(s, box) for s, box in FALLBACK_BOXES.items()
                         if s not in areas]

    def state_of(self, lat, lng):
        p = Point(lng, lat)
        near = []
        for state, (x0, y0, x1, y1), pg, g in self.items:
            if x0 - NEAREST_DEGREES <= lng <= x1 + NEAREST_DEGREES and \
               y0 - NEAREST_DEGREES <= lat <= y1 + NEAREST_DEGREES:
                if x0 <= lng <= x1 and y0 <= lat <= y1 and pg.contains(p):
                    return state
                near.append((state, g))
        # Before "nearest": inside no outline but inside a missing state's
        # box means that state. Otherwise Itanagar, 15 km from the Assam
        # border, would be filed in Assam.
        for state, (la0, la1, ln0, ln1) in self.fallback:
            if la0 <= lat <= la1 and ln0 <= lng <= ln1:
                return state
        best, best_d = None, NEAREST_DEGREES
        for state, g in near:
            d = g.distance(p)
            if d <= best_d:
                best, best_d = state, d
        return best


# ------------------------------------------------------------------- main
def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    fresh = "--fresh" in sys.argv
    wanted = args or list(STATES)
    unknown = [w for w in wanted if w not in STATES]
    if unknown:
        print("Not a state this app knows: " + ", ".join(unknown))
        sys.exit(1)

    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url:
        try:
            import re
            cfg = open("src/config.js", encoding="utf-8").read()
            url = re.search(r'SUPABASE_URL\s*=\s*"([^"]+)"', cfg).group(1).rstrip("/")
        except Exception:
            print("Set SUPABASE_URL, or run this from inside ~/services-app.")
            sys.exit(1)
    if not key:
        import getpass
        key = getpass.getpass("Supabase SERVICE ROLE key (input hidden): ").strip()
    if not key:
        print("No key given.")
        sys.exit(1)

    os.makedirs(WORK, exist_ok=True)
    india = os.path.join(WORK, "india-latest.osm.pbf")
    states_pbf = os.path.join(WORK, "states.pbf")
    places_pbf = os.path.join(WORK, "places.pbf")

    print("\n1. The India file")
    download(india, fresh)

    print("\n2. Cutting out state boundaries and places")
    osmium_filter(india, states_pbf, "r/admin_level=4")
    osmium_filter(india, places_pbf, "nw/place=" + ",".join(PLACE_VALUES))

    print("\n3. State boundaries")
    sa = StateAreas()
    sa.apply_file(states_pbf, locations=True, idx="flex_mem")
    missing = [s for s in wanted if s not in sa.found]
    print(f"  {len(sa.found)} of 36 found" +
          (f"; no boundary for: {', '.join(missing)}" if missing else ""))
    if not sa.found:
        raise SystemExit("No state boundaries at all -- the file looks wrong.")

    print("\n4. Places")
    pl = Places()
    pl.apply_file(places_pbf, locations=True, idx="flex_mem")
    print(f"  {len(pl.rows):,} named places in the file")

    loc = Locator(sa.found)
    by_state = {s: [] for s in wanted}
    seen = set()
    outside = 0
    for i, (name, place, lat, lng) in enumerate(pl.rows):
        if i and i % 200000 == 0:
            print(f"    placed {i:,} / {len(pl.rows):,}", flush=True)
        state = loc.state_of(lat, lng)
        if state is None:
            outside += 1
            continue
        if state not in by_state:
            continue
        k = (state, name.lower())
        if k in seen:
            continue
        seen.add(k)
        by_state[state].append({
            "state": state, "district": None, "block": None,
            "place": name, "kind": KIND[place], "source": "osm",
            "lat": round(lat, 6), "lng": round(lng, 6),
        })
    if outside:
        print(f"  {outside:,} outside every state (neighbouring countries, sea) -- skipped")

    print("\n5. Loading")
    added = fixed = 0
    for state in wanted:
        rows = by_state[state]
        a = f = 0
        for i in range(0, len(rows), BATCH):
            chunk = rows[i:i + BATCH]
            a += count_of(post(url, key, "services_load_regions", {"p_rows": chunk}), "inserted")
            f += count_of(post(url, key, "services_load_region_coords", {"p_rows": chunk}), "updated")
        added += a
        fixed += f
        print(f"  {state:<42} {len(rows):>8,} places  (+{a:,} new, {f:,} given coordinates)",
              flush=True)

    print(f"\nDone. {added:,} new places, {fixed:,} rows given coordinates.")
    print("\nThen, in the Supabase SQL editor:")
    print("  update public.services_workers set locality = locality where lat is null;")
    print("  -- and run sql/76_regions_mark_cities.sql for the counts")


# ---------------------------------------------------------------------------
# ATTRIBUTION
# OpenStreetMap data is ODbL: "Place data © OpenStreetMap contributors".
# Geofabrik's extracts are the same data, redistributed under the same terms.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    main()
