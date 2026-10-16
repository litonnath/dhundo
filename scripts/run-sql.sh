#!/usr/bin/env bash
# Runs every new SQL file (180 to 248) in the right order against your database.
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
225_fee_in_pay_1 225_fee_in_pay_2 225_fee_in_pay_3 225_fee_in_pay_4 225_fee_in_pay_5 225_fee_in_pay_6 225_fee_in_pay_7 225_fee_in_pay_8 226_receipt 227_hold_until_done_1 227_hold_until_done_2 227_hold_until_done_3 228_hold_release_1 228_hold_release_2 228_hold_release_3 229_item_release_1 229_item_release_2 230_refund_queue_1 230_refund_queue_2 230_refund_queue_3 231_rider_cancel 231_one_work 232_vehicle_class_1 232_vehicle_class_2 233_ride_plan_1 233_ride_plan_2 234_plan_live_1 234_plan_live_2 235_plan_code_1 235_plan_code_2 236_live_share 237_plan_no_auto_complete 238_block_while_due 239_popups_1 239_popups_2 239_popups_3 240_phone_otp 241_phone_claim 242_privacy_purge 243_money_guards_1 243_money_guards_2 243_money_guards_3 244_hire_trip_code_1 244_hire_trip_code_2 245_prepaid_lock_1 245_prepaid_lock_2 245_prepaid_lock_3 246_booking_quote_1 246_booking_quote_2 247_pin_reset 248_brand_rename 249_monthly_1 249_monthly_2 249_monthly_3"
START="${START:-180}"; go=0
for f in $FILES; do
  n="${f%%_*}"
  [ "$go" = 0 ] && [ "$n" -ge "$START" ] && go=1
  [ "$go" = 0 ] && continue
  echo "== $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "sql/$f.sql" >/dev/null || { echo "FAILED at $f. Fix it, then: START=$n bash scripts/run-sql.sh"; exit 1; }
done
echo "All SQL done."
