#!/usr/bin/env bash
#
# server-deploy.sh -- the server half of `deploy.cmd`.
#
# Runs on the Contabo box, straight after the zip has been extracted. Kept
# as a file here rather than as a long string inside the .cmd because batch
# and bash disagree about quoting, and every version of that one-liner that
# had a quote in it broke on one side or the other.
#
set -euo pipefail

APP=~/services-app
KEEP=~/config.js.keep

cd "$APP"

# src/config.js is NOT in the zip -- it holds this deployment's Supabase
# project and the deploy that overwrote it once pointed the whole app at the
# hiring database for several hours. deploy.cmd saves it before extracting;
# this puts it back.
if [ -f "$KEEP" ]; then
  cp "$KEEP" "$APP/src/config.js"
  echo "  config.js restored -> $(grep -o 'https://[a-z]*\.supabase\.co' src/config.js | head -1)"
else
  echo "  WARNING: no saved config.js. If this is the first deploy, write"
  echo "           src/config.js by hand before the site will work."
fi

echo "  installing…"
npm install --silent

echo "  building and publishing…"
npm run deploy

# The bundle filename is content-hashed, so a changed name is proof the new
# build actually reached /var/www rather than the old files staying put.
BUNDLE=$(grep -o 'index-[A-Za-z0-9_-]*\.js' /var/www/services/index.html | head -1)
echo
echo "  live bundle: $BUNDLE"

# Both of these have silently failed before: the assetlinks file was
# swallowed by nginx's SPA fallback, and Windows-zipped files arrived as
# mode 700 and 403'd for everyone.
if [ -f /var/www/services/.well-known/assetlinks.json ]; then
  echo "  assetlinks:  present"
else
  echo "  assetlinks:  MISSING"
fi

UNREADABLE=$(find /var/www/services -type f ! -perm -o=r | wc -l)
if [ "$UNREADABLE" -gt 0 ]; then
  echo "  WARNING: $UNREADABLE published files are not world-readable; nginx will 403 them."
  echo "           Fix with: chmod -R a+rX /var/www/services"
else
  echo "  permissions: all readable"
fi
