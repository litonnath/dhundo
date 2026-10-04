#!/usr/bin/env bash
#
# geo-proxy.sh -- run ONCE on the server:   sudo bash geo-proxy.sh
#
# Puts place search and address lookup behind this site's own address:
#
#     /geo/photon/...      ->  photon.komoot.io          (search: shops, roads, villages)
#     /geo/nominatim/...   ->  nominatim.openstreetmap.org   (address of a point, fallback search)
#
# WHY. The app used to ask those two public servers straight from each
# person's browser. That works on one phone and fails on one laptop for reasons
# nobody can see from here: an ad-blocker or a browser's tracking protection
# blocking the host, a school or office network, a rate limit shared by
# everybody behind one address. Asked from the server instead, there is one
# stable address, an identifying User-Agent (which OpenStreetMap's usage policy
# asks for), a rate limit, and a cache -- so the same search twice never
# reaches them at all.
#
# The app uses /geo/ when it answers JSON and falls back to the public servers
# when it does not, so nothing breaks before or without this script.
#
# SAFE TO RUN AGAIN. It backs up the site config first, tests with nginx -t
# BEFORE reloading, and puts everything back if nginx rejects it. It does not
# touch the other sites on this server.
set -euo pipefail

DOMAIN="${DOMAIN:-services.shortlistone.com}"
SITE="${SITE:-/etc/nginx/sites-available/services}"
HTTP_CONF=/etc/nginx/conf.d/dhundo-geo.conf
SNIPPET=/etc/nginx/snippets/dhundo-geo.conf
STAMP=$(date +%F-%H%M%S)
BACKUP="/root/services-nginx.bak-geo-$STAMP"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { red "Run as root (sudo bash geo-proxy.sh)."; exit 1; }
command -v nginx >/dev/null || { red "nginx is not installed here."; exit 1; }
[ -f "$SITE" ] || { red "No site config at $SITE. Set SITE=/path/to/it and run again."; exit 1; }

cp -a "$SITE" "$BACKUP"
echo "backed up $SITE -> $BACKUP"
mkdir -p /etc/nginx/snippets /var/cache/nginx/dhundo_geo

restore() {
  red "nginx rejected the change -- putting everything back."
  cp -a "$BACKUP" "$SITE"
  rm -f "$HTTP_CONF" "$SNIPPET"
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  exit 1
}

# --- http level: the cache, and the two rate limits ------------------------
cat > "$HTTP_CONF" <<'EOF'
# Written by geo-proxy.sh. Answers kept for a day, two rate limits per visitor.
proxy_cache_path /var/cache/nginx/dhundo_geo levels=1:2 keys_zone=dhundo_geo:20m
                 max_size=300m inactive=3d use_temp_path=off;
limit_req_zone $binary_remote_addr zone=dhundo_photon:10m    rate=10r/s;
limit_req_zone $binary_remote_addr zone=dhundo_nominatim:10m rate=2r/s;
EOF

# --- the two locations ------------------------------------------------------
cat > "$SNIPPET" <<'EOF'
# Written by geo-proxy.sh. Included inside this site's server blocks.
location /geo/photon/ {
    limit_req zone=dhundo_photon burst=20 nodelay;
    limit_req_status 429;
    proxy_pass https://photon.komoot.io/;
    proxy_ssl_server_name on;
    proxy_set_header Host photon.komoot.io;
    proxy_set_header User-Agent "Dhundo/1.0 (+https://__DOMAIN__)";
    proxy_set_header Referer "https://__DOMAIN__/";
    proxy_set_header Accept-Encoding "";
    proxy_connect_timeout 5s;
    proxy_read_timeout 15s;
    proxy_cache dhundo_geo;
    proxy_cache_valid 200 1d;
    proxy_cache_valid 404 1m;
    proxy_cache_lock on;
    proxy_cache_use_stale error timeout updating http_429 http_502 http_503;
    add_header X-Geo-Cache $upstream_cache_status always;
}

location /geo/nominatim/ {
    limit_req zone=dhundo_nominatim burst=10 nodelay;
    limit_req_status 429;
    proxy_pass https://nominatim.openstreetmap.org/;
    proxy_ssl_server_name on;
    proxy_set_header Host nominatim.openstreetmap.org;
    proxy_set_header User-Agent "Dhundo/1.0 (+https://__DOMAIN__)";
    proxy_set_header Referer "https://__DOMAIN__/";
    proxy_set_header Accept-Encoding "";
    proxy_connect_timeout 5s;
    proxy_read_timeout 15s;
    proxy_cache dhundo_geo;
    proxy_cache_valid 200 1d;
    proxy_cache_valid 404 1m;
    proxy_cache_lock on;
    proxy_cache_use_stale error timeout updating http_429 http_502 http_503;
    add_header X-Geo-Cache $upstream_cache_status always;
}
EOF
sed -i "s/__DOMAIN__/$DOMAIN/g" "$SNIPPET"

# --- include it in every server block of the site (80 and 443 alike) -------
if grep -q "snippets/dhundo-geo.conf" "$SITE"; then
  echo "the site already includes the snippet."
else
  awk -v d="$DOMAIN" '
    { print }
    $1 == "server_name" && index($0, d) { print "    include snippets/dhundo-geo.conf;" }
  ' "$SITE" > "$SITE.new"
  if ! grep -q "snippets/dhundo-geo.conf" "$SITE.new"; then
    rm -f "$SITE.new"
    red "Could not find 'server_name $DOMAIN;' in $SITE."
    red "Add this line inside its server block by hand, then run nginx -t && systemctl reload nginx:"
    echo "    include snippets/dhundo-geo.conf;"
    cp -a "$BACKUP" "$SITE"; rm -f "$HTTP_CONF" "$SNIPPET"
    exit 1
  fi
  mv "$SITE.new" "$SITE"
fi

nginx -t || restore
systemctl reload nginx || restore
grn "nginx reloaded."

# --- does it answer? --------------------------------------------------------
echo "testing…"
for scheme in https http; do
  OUT=$(curl -sk --max-time 20 --resolve "$DOMAIN:443:127.0.0.1" --resolve "$DOMAIN:80:127.0.0.1" \
        "$scheme://$DOMAIN/geo/photon/api/?q=agartala&limit=1" || true)
  case "$OUT" in
    *'"features"'*) grn "photon via $scheme: OK"; break ;;
    *) echo "photon via $scheme: no JSON yet (${OUT:0:80})" ;;
  esac
done
echo
grn "Done. Reload the site on a laptop and search a place. To undo: restore $BACKUP"
echo "and delete $HTTP_CONF and $SNIPPET, then nginx -t && systemctl reload nginx."
