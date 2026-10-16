#!/usr/bin/env bash
# scripts/add-domain.sh -- serve the SAME site under a second name and give it HTTPS. Run ONCE on the server, as root:
#     sudo bash scripts/add-domain.sh                    # adds dhundonow.shortlistone.com next to the old name
#     sudo NEW=other.example.com OLD=services.shortlistone.com CERTBOT_EMAIL=you@example.com bash scripts/add-domain.sh
# Before you run it, the new name must already point at this server (a DNS "A" record to this server's IP address).
# It backs up the nginx site, adds the new name to its server_name line, tests nginx BEFORE reloading, asks certbot for
# one certificate that covers both names, and puts everything back if anything fails. The old name keeps working.
set -euo pipefail
NEW="${NEW:-dhundonow.shortlistone.com}"
OLD="${OLD:-services.shortlistone.com}"
SITE="${SITE:-/etc/nginx/sites-available/services}"
STAMP=$(date +%F-%H%M%S); BACKUP="/root/services-nginx.bak-domain-$STAMP"
red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { red "Run as root (sudo bash scripts/add-domain.sh)."; exit 1; }
command -v nginx >/dev/null   || { red "nginx is not installed here."; exit 1; }
command -v certbot >/dev/null || { red "certbot is not installed (apt install certbot python3-certbot-nginx)."; exit 1; }
[ -f "$SITE" ] || { red "No site config at $SITE. Set SITE=/path/to/it and run again."; exit 1; }

MYIP=$(curl -4 -s -m 10 https://ifconfig.me || true)
THEIRS=$(getent ahostsv4 "$NEW" | awk '{print $1; exit}' || true)
echo "this server: ${MYIP:-unknown}    $NEW points to: ${THEIRS:-nothing yet}"
if [ -z "$THEIRS" ]; then red "$NEW does not point anywhere yet. Add the DNS A record, wait a few minutes, run again."; exit 1; fi
if [ -n "$MYIP" ] && [ "$MYIP" != "$THEIRS" ]; then red "$NEW points to $THEIRS, not to this server ($MYIP). Fix the DNS record first."; exit 1; fi

cp -a "$SITE" "$BACKUP"; echo "backed up $SITE -> $BACKUP"
restore() { red "Something failed: putting the site config back."; cp -a "$BACKUP" "$SITE"; nginx -t >/dev/null 2>&1 && systemctl reload nginx || true; exit 1; }

if grep -q "server_name .*\b$NEW\b" "$SITE"; then
  echo "$NEW is already in $SITE."
else
  sed -i -E "s/(server_name[^;]*\b$OLD\b)([^;]*);/\1 $NEW\2;/" "$SITE"
  grep -q "server_name .*\b$NEW\b" "$SITE" || { red "Could not find 'server_name $OLD;' in $SITE. Add $NEW to it by hand."; restore; }
fi
nginx -t || restore
systemctl reload nginx

EMAIL_ARGS=(--register-unsafely-without-email)
[ -n "${CERTBOT_EMAIL:-}" ] && EMAIL_ARGS=(-m "$CERTBOT_EMAIL")
certbot --nginx -d "$OLD" -d "$NEW" --non-interactive --agree-tos "${EMAIL_ARGS[@]}" --expand --redirect || restore
nginx -t || restore
systemctl reload nginx
grn "Done. Open https://$NEW in a browser. Then continue with the checklist (secrets, Firebase, Meta, PayU)."
