#!/usr/bin/env bash
# ===========================================================================
# import_all_india.sh -- load every town, village, locality and PIN code in
# India into Supabase, in the right order, asking for the key once.
#
#     cd ~/services-app && bash import_all_india.sh
#
# RUN ON THE SERVER, after sql/75 and sql/76. It needs to reach GeoNames,
# OpenStreetMap and your Supabase project.
#
# Order matters:
#   1. import_regions.py    GeoNames: every populated place, with towns
#                           marked so the town picker has something in it
#   2. import_osm_file.py   OpenStreetMap (one downloaded file): the villages
#                           and paras GeoNames lacks, plus coordinates
#   3. import_pincodes.py   India Post PIN codes via GeoNames, then every
#                           post office as a place (--places)
#
# Every step skips rows already loaded, so running this again is safe --
# and is the thing to do if it stops partway.
#
# Time: step 2 downloads ~1.5 GB once, then 10-30 minutes.
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")"

if [[ -z "${SUPABASE_URL:-}" ]]; then
  SUPABASE_URL=$(sed -n 's/.*SUPABASE_URL *= *"\([^"]*\)".*/\1/p' src/config.js 2>/dev/null | head -1)
fi
if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Could not read SUPABASE_URL from src/config.js. Set it and run again:"
  echo "  export SUPABASE_URL=https://YOURPROJECT.supabase.co"
  exit 1
fi
export SUPABASE_URL
echo "Supabase: $SUPABASE_URL"

if [[ -z "${SUPABASE_SERVICE_KEY:-}" ]]; then
  # -s keeps it off the screen, and reading it here keeps it out of shell
  # history. It lives only in this process's environment.
  read -rsp "Supabase SERVICE ROLE key (input hidden): " SUPABASE_SERVICE_KEY; echo
fi
[[ -n "$SUPABASE_SERVICE_KEY" ]] || { echo "No key given."; exit 1; }
export SUPABASE_SERVICE_KEY

echo; echo "=== 1/3  Places from GeoNames ==="
python3 import_regions.py

echo; echo "=== 2/3  Villages and localities from OpenStreetMap ==="
# From one downloaded India file (import_osm_file.py) rather than the public
# Overpass servers, which time out and rate-limit. Needs, once:
#   apt-get install -y osmium-tool python3-pyosmium python3-shapely
python3 import_osm_file.py "$@"

echo; echo "=== 3/3  PIN codes, and post offices as places ==="
python3 import_pincodes.py
# Every post office as a village or locality: the fullest list of names for
# states the gazetteers cover thinly (Tripura, Assam, West Bengal).
python3 import_pincodes.py --places

cat <<'EOF'

All three steps ran. Two things to finish in the Supabase SQL editor:

  -- give existing listings coordinates from their area and PIN code
  update public.services_workers set locality = locality where lat is null;
  update public.services_workers set pincode = pincode;

  -- see what loaded
  select state, count(*) as places, count(*) filter (where is_city) as towns
    from public.services_regions group by state order by state;
EOF
