#!/usr/bin/env bash
# One go for the payment setup that needs your accounts: sets the Supabase
# secrets and deploys the two PayU functions. Run it from the project folder
# (the one that contains supabase/functions). It asks for your PayU key and salt
# and does not write them to any file or to the screen.
#   bash scripts/payments-setup.sh
set -e
REF="nowhtdsuestyduzqtcks"
[ -d supabase/functions/payu-order ] || { echo "Run this from the project folder (it must contain supabase/functions/payu-order)."; exit 1; }
command -v supabase >/dev/null || { echo "The supabase command is not installed."; exit 1; }

read -r -p "Site address (for example https://dhundo.in): " APP_URL
read -r -p "Testing with PayU TEST keys? (y/n): " TEST
read -r -p "PayU merchant KEY: " KEY
read -r -s -p "PayU merchant SALT (hidden): " SALT; echo
APP_URL="${APP_URL%/}"
supabase secrets set PAYU_KEY="$KEY" PAYU_SALT="$SALT" APP_URL="$APP_URL" --project-ref "$REF"
if [ "$TEST" = "y" ] || [ "$TEST" = "Y" ]; then
  supabase secrets set PAYU_BASE="https://test.payu.in/_payment" --project-ref "$REF"
else
  supabase secrets unset PAYU_BASE --project-ref "$REF" || true
fi
supabase functions deploy payu-order --project-ref "$REF"
supabase functions deploy payu-callback --no-verify-jwt --project-ref "$REF"
echo
echo "Done. PayU webhook address (optional, in the PayU dashboard):"
echo "  https://$REF.supabase.co/functions/v1/payu-callback"
echo "Next: run the SQL files listed in docs/PAYMENTS_SETUP.md in the Supabase SQL editor."
