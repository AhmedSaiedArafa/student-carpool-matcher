#!/usr/bin/env bash
# Final-report API tests against the DEPLOYED Floci backend.
# Run from the project root:  bash infra/floci/report-tests.sh
set -uo pipefail

export AWS_PROFILE="${AWS_PROFILE:-floci}"

if ! aws configure get endpoint_url --profile floci >/dev/null 2>&1; then
  aws configure set aws_access_key_id test --profile floci
  aws configure set aws_secret_access_key test --profile floci
  aws configure set region us-east-1 --profile floci
  aws configure set endpoint_url http://localhost:4566 --profile floci
fi

# ── Discover the API URL ────────────────────────────────────────────
API_ID=$(AWS_PROFILE=floci aws apigatewayv2 get-apis \
  --query "Items[?Name=='carpool-http-api'].ApiId | [0]" --output text)
if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  echo "ERROR: Could not find the carpool-http-api. Is the backend deployed?"
  exit 1
fi
BASE="http://${API_ID}.execute-api.localhost.floci.io:4566/api"
echo "API base: $BASE"

mkdir -p out

# ── Helpers ─────────────────────────────────────────────────────────
PASS=0; FAIL=0
declare -a RESULTS=()

truncate_body() { echo "$1" | tr '\n' ' ' | cut -c1-150; }

run_test() {
  local id="$1" service="$2" scenario="$3" expected="$4" method="$5" url="$6"
  shift 6
  # remaining args: extra curl flags
  local resp status body
  resp=$(curl -s -w '\n%{http_code}' -X "$method" "$url" "$@" 2>&1)
  status=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  local result
  if [ "$status" = "$expected" ]; then
    result="PASS"; PASS=$((PASS+1))
  else
    result="FAIL"; FAIL=$((FAIL+1))
  fi
  local snippet
  snippet=$(truncate_body "$body")
  printf "%-8s %-18s %-45s  expect=%-4s actual=%-4s %s\n" \
    "$id" "$service" "$scenario" "$expected" "$status" "$result"
  RESULTS+=("| $id | $service | $scenario | $expected | $status | $result | \`${snippet}\` |")
  # export for caller
  LAST_STATUS="$status"
  LAST_BODY="$body"
}

json_val() { echo "$1" | sed 's/.*"'"$2"'"[[:space:]]*:[[:space:]]*"\{0,1\}\([^",}]*\)"\{0,1\}.*/\1/' | head -1; }

# Portable JSON value extractor using node (handles nested "data" wrapper)
jv() {
  local json="$1" key="$2"
  echo "$json" | node -e "
let c='';process.stdin.on('data',d=>c+=d);process.stdin.on('end',()=>{
  try{let v=JSON.parse(c);
  for(const k of '${key}'.split('.')){
    if(v&&typeof v==='object'&&!Array.isArray(v))v=v[k];
    else if(Array.isArray(v)&&/^\d+$/.test(k))v=v[parseInt(k)];
    else{v=undefined;break}}
  console.log(v==null?'':v)}catch{console.log('')}});
" 2>/dev/null
}

# ── Log in all four users & keep tokens ─────────────────────────────
login_user() {
  local email="$1"
  local resp
  resp=$(curl -s -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"university_email\":\"$email\",\"password\":\"Password123!\"}")
  echo "$resp" | node -e "
let c='';process.stdin.on('data',d=>c+=d);process.stdin.on('end',()=>{
  try{console.log(JSON.parse(c).data.token)}catch{console.log('')}});"
}

echo ""
echo "Logging in users..."
TOK_D1=$(login_user "driver1@university.edu")
TOK_D2=$(login_user "driver2@university.edu")
TOK_R1=$(login_user "rider1@university.edu")
TOK_R2=$(login_user "rider2@university.edu")

# get user ids from the tokens (they are JWTs – decode payload)
decode_jwt_id() {
  echo "$1" | node -e "
let c='';process.stdin.on('data',d=>c+=d);process.stdin.on('end',()=>{
  const t=c.trim().split('.')[1];
  const b=Buffer.from(t,'base64').toString();
  console.log(JSON.parse(b).id);
});" 2>/dev/null
}
ID_D1=$(decode_jwt_id "$TOK_D1")
ID_D2=$(decode_jwt_id "$TOK_D2")
ID_R1=$(decode_jwt_id "$TOK_R1")
ID_R2=$(decode_jwt_id "$TOK_R2")

echo "  driver1 id=$ID_D1  driver2 id=$ID_D2  rider1 id=$ID_R1  rider2 id=$ID_R2"
echo ""

AUTH_D1="Authorization: Bearer $TOK_D1"
AUTH_D2="Authorization: Bearer $TOK_D2"
AUTH_R1="Authorization: Bearer $TOK_R1"
AUTH_R2="Authorization: Bearer $TOK_R2"
CT="Content-Type: application/json"

# ── Compute dates for ride creation (using node) ────────────────────
date_offset() { node -e "const d=new Date();d.setDate(d.getDate()+$1);console.log(d.toISOString().split('T')[0])"; }
TOMORROW=$(date_offset 1)
NEXT_WEEK=$(date_offset 7)
NEXT_MONTH=$(date_offset 30)
FAR_DATE=$(date_offset 120)
WEEKDAY_NUM=$(node -e "const d=new Date();d.setDate(d.getDate()+7);console.log(d.getDay())")

# ═══════════════════════════════════════════════════════════════════
# SHARED TESTS (SH)
# ═══════════════════════════════════════════════════════════════════
echo "=== Shared Tests ==="

run_test "SH-01" "Shared" "Health check" 200 GET "$BASE/health"

run_test "SH-02" "Shared" "Stats" 200 GET "$BASE/stats"

run_test "SH-03" "Shared" "Login OK (driver1)" 200 POST "$BASE/auth/login" \
  -H "$CT" -d '{"university_email":"driver1@university.edu","password":"Password123!"}'

run_test "SH-04" "Shared" "Login wrong password" 401 POST "$BASE/auth/login" \
  -H "$CT" -d '{"university_email":"driver1@university.edu","password":"wrong"}'

run_test "SH-05" "Shared" "Login missing fields" 400 POST "$BASE/auth/login" \
  -H "$CT" -d '{"university_email":"driver1@university.edu"}'

run_test "SH-06" "Shared" "Register invalid email" 400 POST "$BASE/auth/register" \
  -H "$CT" -d '{"university_email":"bad@gmail.com","password":"Password123!","name":"Test","role":"rider"}'

run_test "SH-07" "Shared" "Call without token (401)" 401 GET "$BASE/auth/profile"

run_test "SH-08" "Shared" "Invalid token (401)" 401 GET "$BASE/auth/profile" \
  -H "Authorization: Bearer invalidtoken123"

# ═══════════════════════════════════════════════════════════════════
# RIDE MANAGEMENT (RM) – Remas
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "=== Ride Management Tests ==="

run_test "RM-01" "Rides" "Publish one-time ride" 201 POST "$BASE/rides" \
  -H "$CT" -H "$AUTH_D1" \
  -d "{\"origin_lat\":30.05,\"origin_lng\":31.24,\"destination_lat\":30.01,\"destination_lng\":31.21,\"departure_time\":\"09:00\",\"seats_total\":3,\"schedule_type\":\"once\",\"trip_date\":\"$TOMORROW\",\"fare\":40,\"origin_name\":\"Giza\",\"destination_name\":\"CU\"}"
ONCE_TEMPLATE_ID=$(jv "$LAST_BODY" "data.template.id")
ONCE_TRIP_ID=$(jv "$LAST_BODY" "data.instances.0.id")
echo "  -> one-time template=$ONCE_TEMPLATE_ID trip=$ONCE_TRIP_ID"

run_test "RM-02" "Rides" "Publish weekly ride" 201 POST "$BASE/rides" \
  -H "$CT" -H "$AUTH_D1" \
  -d "{\"origin_lat\":30.04,\"origin_lng\":31.23,\"destination_lat\":30.01,\"destination_lng\":31.21,\"departure_time\":\"08:30\",\"seats_total\":4,\"schedule_type\":\"weekly\",\"weekdays\":[1,3],\"start_date\":\"$NEXT_WEEK\",\"end_date\":\"$NEXT_MONTH\",\"fare\":50,\"origin_name\":\"Tahrir\",\"destination_name\":\"CU\"}"
WEEKLY_TEMPLATE_ID=$(jv "$LAST_BODY" "data.template.id")
WEEKLY_FIRST_TRIP=$(jv "$LAST_BODY" "data.instances.0.id")
echo "  -> weekly template=$WEEKLY_TEMPLATE_ID first_trip=$WEEKLY_FIRST_TRIP"

run_test "RM-03" "Rides" "Publish with seats=0 (400)" 400 POST "$BASE/rides" \
  -H "$CT" -H "$AUTH_D1" \
  -d "{\"origin_lat\":30.05,\"origin_lng\":31.24,\"destination_lat\":30.01,\"destination_lng\":31.21,\"departure_time\":\"09:00\",\"seats_total\":0,\"schedule_type\":\"once\",\"trip_date\":\"$TOMORROW\"}"

run_test "RM-04" "Rides" "Publish with end_date > 3 months (400)" 400 POST "$BASE/rides" \
  -H "$CT" -H "$AUTH_D1" \
  -d "{\"origin_lat\":30.05,\"origin_lng\":31.24,\"destination_lat\":30.01,\"destination_lng\":31.21,\"departure_time\":\"09:00\",\"seats_total\":2,\"schedule_type\":\"weekly\",\"weekdays\":[1],\"start_date\":\"$NEXT_WEEK\",\"end_date\":\"$FAR_DATE\"}"

run_test "RM-05" "Rides" "My rides" 200 GET "$BASE/rides/mine" \
  -H "$AUTH_D1"

run_test "RM-06" "Rides" "Edit a ride (change fare)" 200 PATCH "$BASE/rides/$ONCE_TEMPLATE_ID" \
  -H "$CT" -H "$AUTH_D1" \
  -d '{"fare":35}'

# To test edit seats below booked we need an approved rider first; we'll use the E2E trip.
# For now test with the weekly template that has no bookings.
run_test "RM-07" "Rides" "Edit someone else's ride (403)" 403 PATCH "$BASE/rides/$ONCE_TEMPLATE_ID" \
  -H "$CT" -H "$AUTH_D2" \
  -d '{"fare":99}'

run_test "RM-08" "Rides" "Trip that doesn't exist (404)" 404 GET "$BASE/trips/999999" \
  -H "$AUTH_D1"

# ═══════════════════════════════════════════════════════════════════
# MATCHING & REQUESTS (MR) – Ahmed
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "=== Matching & Requests Tests ==="

run_test "MR-01" "Matching" "Search matches" 200 GET \
  "$BASE/matches?pickupLat=30.05&pickupLng=31.24&dropoffLat=30.01&dropoffLng=31.21" \
  -H "$AUTH_R1"

run_test "MR-02" "Matching" "Search without coordinates (400)" 400 GET \
  "$BASE/matches" \
  -H "$AUTH_R1"

run_test "MR-03" "Matching" "Request a seat with offered price" 201 POST \
  "$BASE/trips/$ONCE_TRIP_ID/requests" \
  -H "$CT" -H "$AUTH_R1" \
  -d '{"offered_fare":38,"pickup_lat":30.05,"pickup_lng":31.24}'
REQUEST_ID=$(jv "$LAST_BODY" "data.id")
echo "  -> request id=$REQUEST_ID"

run_test "MR-04" "Matching" "Request same trip twice (409)" 409 POST \
  "$BASE/trips/$ONCE_TRIP_ID/requests" \
  -H "$CT" -H "$AUTH_R1" \
  -d '{"offered_fare":38}'

run_test "MR-05" "Matching" "Offered price -5 (400)" 400 POST \
  "$BASE/trips/$ONCE_TRIP_ID/requests" \
  -H "$CT" -H "$AUTH_R2" \
  -d '{"offered_fare":-5}'

run_test "MR-06" "Matching" "My requests (rider1)" 200 GET \
  "$BASE/requests/mine" \
  -H "$AUTH_R1"

run_test "MR-07" "Matching" "Withdraw a pending request" 204 DELETE \
  "$BASE/requests/$REQUEST_ID" \
  -H "$AUTH_R1"

run_test "MR-08" "Matching" "Geocode Cairo University" 200 GET \
  "$BASE/geocode?q=Cairo%20University" \
  -H "$AUTH_R1"

run_test "MR-09" "Matching" "Geocode empty q (400)" 400 GET \
  "$BASE/geocode?q=" \
  -H "$AUTH_R1"

run_test "MR-10" "Matching" "Notifications list" 200 GET \
  "$BASE/notifications" \
  -H "$AUTH_R1"

# ═══════════════════════════════════════════════════════════════════
# RIDE MANAGEMENT continued: accept / reject after requests exist
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "=== Accept / Reject Tests ==="

# rider2 requests the once trip so driver1 can accept
run_test "RM-09" "Rides" "Rider2 requests once trip" 201 POST \
  "$BASE/trips/$ONCE_TRIP_ID/requests" \
  -H "$CT" -H "$AUTH_R2" \
  -d '{"offered_fare":40}'
REQ2_ID=$(jv "$LAST_BODY" "data.id")
echo "  -> request id=$REQ2_ID"

run_test "RM-10" "Rides" "Accept request" 200 PATCH \
  "$BASE/requests/$REQ2_ID/decision" \
  -H "$CT" -H "$AUTH_D1" \
  -d '{"decision":"approved"}'

run_test "RM-11" "Rides" "Accept same request again (409)" 409 PATCH \
  "$BASE/requests/$REQ2_ID/decision" \
  -H "$CT" -H "$AUTH_D1" \
  -d '{"decision":"approved"}'

# rider2 requests the WEEKLY trip so driver1 can reject it
run_test "RM-12a" "Rides" "Rider2 requests weekly trip" 201 POST \
  "$BASE/trips/$WEEKLY_FIRST_TRIP/requests" \
  -H "$CT" -H "$AUTH_R2" \
  -d '{"offered_fare":45}'
REQ3_ID=$(jv "$LAST_BODY" "data.id")
echo "  -> request to reject id=$REQ3_ID"

run_test "RM-12" "Rides" "Reject a request" 200 PATCH \
  "$BASE/requests/$REQ3_ID/decision" \
  -H "$CT" -H "$AUTH_D1" \
  -d '{"decision":"rejected"}'

# rider1 re-requests the once trip after withdrawing (tests re-request after withdraw)
run_test "RM-13c" "Rides" "Rider1 re-requests once trip" 201 POST \
  "$BASE/trips/$ONCE_TRIP_ID/requests" \
  -H "$CT" -H "$AUTH_R1" \
  -d '{"offered_fare":38}'
REQ4_ID=$(jv "$LAST_BODY" "data.id")

run_test "RM-13d" "Rides" "Accept rider1 on once trip" 200 PATCH \
  "$BASE/requests/$REQ4_ID/decision" \
  -H "$CT" -H "$AUTH_D1" \
  -d '{"decision":"approved"}'

# Once trip now has 2 approved riders (rider2 from RM-10, rider1 from RM-13d)
# seats_total=3, try to set to 1 which is below 2 booked -> 409
run_test "RM-13" "Rides" "Edit seats below booked (409)" 409 PATCH \
  "$BASE/rides/$ONCE_TEMPLATE_ID" \
  -H "$CT" -H "$AUTH_D1" \
  -d '{"seats_total":1}'

# ═══════════════════════════════════════════════════════════════════
# HISTORY & RELIABILITY (HR) – Youssef
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "=== History & Reliability Tests ==="

# Complete the once trip (driver1 is owner, rider2 is approved)
run_test "HR-01" "History" "Complete trip with attendance" 200 PATCH \
  "$BASE/trips/$ONCE_TRIP_ID/complete" \
  -H "$CT" -H "$AUTH_D1" \
  -d "{\"attendance\":[{\"rider_id\":$ID_R1,\"showed_up\":true},{\"rider_id\":$ID_R2,\"showed_up\":true}]}"

run_test "HR-02" "History" "Complete again (409)" 409 PATCH \
  "$BASE/trips/$ONCE_TRIP_ID/complete" \
  -H "$CT" -H "$AUTH_D1" \
  -d '{"attendance":[]}'

# rider2 rates driver1
run_test "HR-03" "History" "Rate the driver" 201 POST \
  "$BASE/trips/$ONCE_TRIP_ID/ratings" \
  -H "$CT" -H "$AUTH_R2" \
  -d "{\"subject_id\":$ID_D1,\"score\":5,\"comment\":\"Excellent driver!\"}"

run_test "HR-04" "History" "Rate again (409)" 409 POST \
  "$BASE/trips/$ONCE_TRIP_ID/ratings" \
  -H "$CT" -H "$AUTH_R2" \
  -d "{\"subject_id\":$ID_D1,\"score\":4}"

run_test "HR-05" "History" "Rate with score 7 (400)" 400 POST \
  "$BASE/trips/$ONCE_TRIP_ID/ratings" \
  -H "$CT" -H "$AUTH_D1" \
  -d "{\"subject_id\":$ID_R2,\"score\":7}"

run_test "HR-06" "History" "Rate yourself (400)" 400 POST \
  "$BASE/trips/$ONCE_TRIP_ID/ratings" \
  -H "$CT" -H "$AUTH_R2" \
  -d "{\"subject_id\":$ID_R2,\"score\":4}"

# driver2 is not a participant on the once trip → 403
run_test "HR-07" "History" "Non-participant rates (403)" 403 POST \
  "$BASE/trips/$ONCE_TRIP_ID/ratings" \
  -H "$CT" -H "$AUTH_D2" \
  -d "{\"subject_id\":$ID_D1,\"score\":5}"

run_test "HR-08" "History" "History" 200 GET "$BASE/history" \
  -H "$AUTH_R2"

run_test "HR-09" "History" "Reliability" 200 GET "$BASE/users/$ID_D1/reliability" \
  -H "$AUTH_R1"

run_test "HR-10" "History" "Badges" 200 GET "$BASE/users/$ID_D1/badges" \
  -H "$AUTH_R1"

# ═══════════════════════════════════════════════════════════════════
# END-TO-END (E2E)
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "=== End-to-End Test ==="

# 1. driver2 publishes a new ride
run_test "E2E-01" "E2E" "Driver publishes ride" 201 POST "$BASE/rides" \
  -H "$CT" -H "$AUTH_D2" \
  -d "{\"origin_lat\":30.06,\"origin_lng\":31.25,\"destination_lat\":30.01,\"destination_lng\":31.21,\"departure_time\":\"10:00\",\"seats_total\":2,\"schedule_type\":\"once\",\"trip_date\":\"$TOMORROW\",\"fare\":60,\"origin_name\":\"Ramses\",\"destination_name\":\"CU\"}"
E2E_TEMPLATE=$(jv "$LAST_BODY" "data.template.id")
E2E_TRIP=$(jv "$LAST_BODY" "data.instances.0.id")
echo "  -> E2E template=$E2E_TEMPLATE trip=$E2E_TRIP"

# 2. rider1 searches
run_test "E2E-02" "E2E" "Rider searches matches" 200 GET \
  "$BASE/matches?pickupLat=30.06&pickupLng=31.25" \
  -H "$AUTH_R1"

# 3. rider1 requests with a price
run_test "E2E-03" "E2E" "Rider requests with price" 201 POST \
  "$BASE/trips/$E2E_TRIP/requests" \
  -H "$CT" -H "$AUTH_R1" \
  -d '{"offered_fare":55,"pickup_lat":30.06,"pickup_lng":31.25}'
E2E_REQ=$(jv "$LAST_BODY" "data.id")

# 4. driver2 accepts (seats -1)
run_test "E2E-04" "E2E" "Driver accepts (seats-1)" 200 PATCH \
  "$BASE/requests/$E2E_REQ/decision" \
  -H "$CT" -H "$AUTH_D2" \
  -d '{"decision":"approved"}'

# Check seats went down
run_test "E2E-05" "E2E" "Trip details show reduced seats" 200 GET \
  "$BASE/trips/$E2E_TRIP" \
  -H "$AUTH_D2"
E2E_SEATS=$(jv "$LAST_BODY" "data.seats_remaining")
echo "  -> seats_remaining=$E2E_SEATS (expect 1)"

# 5. driver2 completes
run_test "E2E-06" "E2E" "Driver completes trip" 200 PATCH \
  "$BASE/trips/$E2E_TRIP/complete" \
  -H "$CT" -H "$AUTH_D2" \
  -d "{\"attendance\":[{\"rider_id\":$ID_R1,\"showed_up\":true}]}"

# 6. rider1 rates driver2
run_test "E2E-07" "E2E" "Rider rates driver" 201 POST \
  "$BASE/trips/$E2E_TRIP/ratings" \
  -H "$CT" -H "$AUTH_R1" \
  -d "{\"subject_id\":$ID_D2,\"score\":4,\"comment\":\"Good ride\"}"

# 7. driver2 rates rider1
run_test "E2E-08" "E2E" "Driver rates rider" 201 POST \
  "$BASE/trips/$E2E_TRIP/ratings" \
  -H "$CT" -H "$AUTH_D2" \
  -d "{\"subject_id\":$ID_R1,\"score\":5,\"comment\":\"Great passenger\"}"

# 8. profile shows updated rating
run_test "E2E-09" "E2E" "Profile shows new rating" 200 GET \
  "$BASE/users/$ID_D2/ratings" \
  -H "$AUTH_R1"

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
TOTAL=$((PASS+FAIL))
echo ""
echo "=============================="
echo "  PASSED: $PASS / $TOTAL"
echo "  FAILED: $FAIL / $TOTAL"
echo "=============================="

# Write markdown report
{
  echo "# API Test Report"
  echo ""
  echo "**Date:** $(date '+%Y-%m-%d %H:%M:%S')"
  echo "**API:** $BASE"
  echo "**Total:** $TOTAL  |  **Passed:** $PASS  |  **Failed:** $FAIL"
  echo ""
  echo "| ID | Service | Scenario | Expected | Actual | Result | Response (first 150 chars) |"
  echo "|---|---|---|---|---|---|---|"
  for row in "${RESULTS[@]}"; do
    echo "$row"
  done
  echo ""
  echo "---"
  echo "*Generated by \`infra/floci/report-tests.sh\`*"
} > out/report-tests.md

echo ""
echo "Report saved to out/report-tests.md"
