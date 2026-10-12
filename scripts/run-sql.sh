#!/usr/bin/env bash
# Runs every new SQL file (180 to 226) in the right order against your database.
# Needs psql. Get the connection string in Supabase > Project Settings > Database >
# Connection string (URI), and put your database password in it. Type it here, never in chat:
#   export DATABASE_URL='postgresql://postgres:YOURPASSWORD@db.nowhtdsuestyduzqtcks.supabase.co:5432/postgres'
#   bash scripts/run-sql.sh
# It stops at the first file that fails, so you can fix that one and run it again
# (running a file twice is safe). Use START=212 bash scripts/run-sql.sh to begin later.
set -u
cd "$(dirname "$0")/.."
[ -z "${DATABASE_URL:-}" ] && { echo "Set DATABASE_URL first (see the top of this file)."; exit 1; }
command -v psql >/dev/null || { echo "psql is not installed (sudo apt install postgresql-client)."; exit 1; }
FILES="180_menu_photos 181_no_rider_fallback_1 181_no_rider_fallback_2 182_delivery_quote 182_job_distances
183_ride_rates_1 183_ride_rates_2 184_order_rider_position 185_order_set_drop 186_rider_points 187_delivery_ratings
188_ratings_rides 189_admin_quality 190_delivery_rateable 191_pricing_defaults 192_cod_paid_on_delivery
193_my_order_ratings 194_order_delivery_ratings 195_job_accept_far 196_fee_range_1 197_fee_bounds 198_food_gst_5
199_inbox_rate 200_profile_photo 201_booking_complete 202_booking_reschedule 203_worker_busy 204_booking_remove
205_worker_card_extra 206_booking_done_rate 207_booking_reports 208_ride_rates_cheaper 209_other_categories
210_worker_kinds 211_pickup_collected 212_support_1 212_support_2 212_support_3 213_payments_1 213_payments_2
214_earnings 215_wallet_1 215_wallet_2 216_refunds 217_admin_payments 218_pay_flags 219_booking_pay_1
219_booking_pay_2 219_booking_pay_3 220_payments_received 221_admin_refunds_1 221_admin_refunds_2
222_withdraw_1 222_withdraw_2 223_pay_guard_1 223_pay_guard_2
224_online_first_1 224_online_first_2 224_online_first_3 224_online_first_4 224_online_first_5
225_fee_in_pay_1 225_fee_in_pay_2 225_fee_in_pay_3 225_fee_in_pay_4 225_fee_in_pay_5 225_fee_in_pay_6 225_fee_in_pay_7 225_fee_in_pay_8 226_receipt"
START="${START:-180}"; go=0
for f in $FILES; do
  n="${f%%_*}"
  [ "$go" = 0 ] && [ "$n" -ge "$START" ] && go=1
  [ "$go" = 0 ] && continue
  echo "== $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "sql/$f.sql" >/dev/null || { echo "FAILED at $f. Fix it, then: START=$n bash scripts/run-sql.sh"; exit 1; }
done
echo "All SQL done."
