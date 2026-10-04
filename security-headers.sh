#!/usr/bin/env bash
#
# security-headers.sh -- run ONCE on the server:   sudo bash security-headers.sh
#
# Adds the browser security headers to the site (no click-hijacking, no
# content sniffing, https only, a Content-Security-Policy) and hides the nginx
# version. The Content-Security-Policy starts in REPORT-ONLY mode, which
# blocks nothing: open the site, use it, look in the browser console for
# "Content-Security-Policy-Report-Only" messages, and when there are none run
#     sudo CSP_ENFORCE=1 bash security-headers.sh
# to make it enforce.
#
# Safe to run again. Backs up the site config, runs nginx -t BEFORE reloading,
# and puts everything back if nginx rejects it.
set -euo pipefail

DOMAIN="${DOMAIN:-services.shortlistone.com}"
SITE="${SITE:-/etc/nginx/sites-available/services}"
SNIPPET=/etc/nginx/snippets/dhundo-security.conf
STAMP=$(date +%F-%H%M%S)
BACKUP="/root/services-nginx.bak-sec-$STAMP"
CSP_HEADER="Content-Security-Policy-Report-Only"
[ "${CSP_ENFORCE:-0}" = "1" ] && CSP_HEADER="Content-Security-Policy"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { red "Run as root (sudo bash security-headers.sh)."; exit 1; }
command -v nginx >/dev/null || { red "nginx is not installed here."; exit 1; }
[ -f "$SITE" ] || { red "No site config at $SITE. Set SITE=/path/to/it and run again."; exit 1; }

cp -a "$SITE" "$BACKUP"
echo "backed up $SITE -> $BACKUP"
mkdir -p /etc/nginx/snippets

restore() {
  red "nginx rejected the change -- putting everything back."
  cp -a "$BACKUP" "$SITE"
  rm -f "$SNIPPET"
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  exit 1
}

CSP="default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.hcaptcha.com https://tile.googleapis.com https://maps.googleapis.com https://places.googleapis.com https://routes.googleapis.com https://overpass-api.de https://overpass.kumi.systems https://photon.komoot.io https://nominatim.openstreetmap.org; script-src 'self' https://challenges.cloudflare.com https://js.hcaptcha.com https://*.hcaptcha.com; frame-src https://challenges.cloudflare.com https://*.hcaptcha.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"

cat > "$SNIPPET" <<EOF
# Written by security-headers.sh. Included inside this site's server blocks.
server_tokens off;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(self), camera=(self), microphone=()" always;
add_header Strict-Transport-Security "max-age=31536000" always;
add_header $CSP_HEADER "$CSP" always;
EOF

if grep -q "snippets/dhundo-security.conf" "$SITE"; then
  echo "the site already includes the snippet."
else
  awk -v d="$DOMAIN" '
    { print }
    $1 == "server_name" && index($0, d) { print "    include snippets/dhundo-security.conf;" }
  ' "$SITE" > "$SITE.new"
  if ! grep -q "snippets/dhundo-security.conf" "$SITE.new"; then
    rm -f "$SITE.new"
    red "Could not find 'server_name $DOMAIN;' in $SITE."
    red "Add this line inside its server block by hand, then run nginx -t && systemctl reload nginx:"
    echo "    include snippets/dhundo-security.conf;"
    cp -a "$BACKUP" "$SITE"; rm -f "$SNIPPET"
    exit 1
  fi
  mv "$SITE.new" "$SITE"
fi

# add_header in a location block REPLACES the server-level ones. The geo
# proxy locations add X-Geo-Cache, so they would lose these headers; the
# snippet is included in their server blocks, which is what matters for pages.
nginx -t || restore
systemctl reload nginx || restore
grn "nginx reloaded."

echo "testing…"
HDRS=$(curl -skI --max-time 20 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || true)
for h in x-content-type-options x-frame-options strict-transport-security; do
  echo "$HDRS" | grep -qi "^$h:" && grn "$h: present" || red "$h: missing (check the site block)"
done
echo
grn "Done. Mode: $CSP_HEADER. To undo: restore $BACKUP, delete $SNIPPET, nginx -t && systemctl reload nginx."
