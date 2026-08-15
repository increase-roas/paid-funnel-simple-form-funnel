#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
WORK_DIR="$(mktemp -d)"
COOKIE_JAR="${WORK_DIR}/cookies.txt"
OUTSIDE_COOKIE_JAR="${WORK_DIR}/outside-cookies.txt"
RUN_ID="$(date +%s%N)"
PHONE_SUFFIX="${RUN_ID: -4}"
SMOKE_PHONE="701300${PHONE_SUFFIX}"
SMOKE_EMAIL="smoke.test.${RUN_ID}@example.com"
trap 'rm -rf "${WORK_DIR}"' EXIT

get_page() {
  local path="$1"
  local body="$2"
  local headers="$3"
  curl --fail --silent --show-error \
    --cookie "${COOKIE_JAR}" \
    --cookie-jar "${COOKIE_JAR}" \
    --dump-header "${headers}" \
    --output "${body}" \
    "${BASE_URL}${path}"
}

post_step() {
  local number="$1"
  local expected_location="$2"
  shift 2
  local headers="${WORK_DIR}/post-${number}.headers"

  curl --silent --show-error \
    --cookie "${COOKIE_JAR}" \
    --cookie-jar "${COOKIE_JAR}" \
    --dump-header "${headers}" \
    --output /dev/null \
    --request POST \
    --header "Origin: ${BASE_URL}" \
    "$@" \
    "${BASE_URL}/api/funnel/hot-tub-offer/step/${number}"

  grep -Eq '^HTTP/[^ ]+ 303' "${headers}"
  grep -Fqi "location: ${BASE_URL}${expected_location}" "${headers}"
}

get_page "/lp/hot-tub-offer/step/1?utm_source=smoke&fbclid=smoke-click" "${WORK_DIR}/step-1.html" "${WORK_DIR}/step-1.headers"
grep -q "Advertisement" "${WORK_DIR}/step-1.html"
grep -q "Local hot tub availability" "${WORK_DIR}/step-1.html"
grep -q "data-preloaded-funnel" "${WORK_DIR}/step-1.html"
grep -q "Which type of spa" "${WORK_DIR}/step-1.html"
grep -q "Great News — You Qualify" "${WORK_DIR}/step-1.html"
grep -q "wizard_leave_attempt" "${WORK_DIR}/step-1.html"
grep -q "retention_visible" "${WORK_DIR}/step-1.html"
grep -q "BroadcastChannel" "${WORK_DIR}/step-1.html"
grep -q "x-funnel-navigation" "${WORK_DIR}/step-1.html"
grep -Eiq '^x-robots-tag: noindex' "${WORK_DIR}/step-1.headers"

post_step 1 "/lp/hot-tub-offer/step/2" --data-urlencode "zip=58701"
get_page "/lp/hot-tub-offer/step/2" "${WORK_DIR}/step-2.html" "${WORK_DIR}/step-2.headers"
grep -q "Which type of spa" "${WORK_DIR}/step-2.html"

post_step 2 "/lp/hot-tub-offer/step/3" --data-urlencode "answer=hot-tub"
get_page "/lp/hot-tub-offer/step/3" "${WORK_DIR}/step-3.html" "${WORK_DIR}/step-3.headers"
grep -q "When are you hoping" "${WORK_DIR}/step-3.html"

post_step 3 "/lp/hot-tub-offer/step/4" --data-urlencode "answer=within-30-days"
get_page "/lp/hot-tub-offer/step/4" "${WORK_DIR}/step-4.html" "${WORK_DIR}/step-4.headers"
grep -q "How many people" "${WORK_DIR}/step-4.html"

post_step 4 "/lp/hot-tub-offer/step/5" --data-urlencode "answer=four-to-five"
get_page "/lp/hot-tub-offer/step/5" "${WORK_DIR}/step-5.html" "${WORK_DIR}/step-5.headers"
grep -q "Which features matter most" "${WORK_DIR}/step-5.html"

post_step 5 "/lp/hot-tub-offer/step/6" \
  --data-urlencode "answer=hydrotherapy" \
  --data-urlencode "answer=energy-efficiency"
get_page "/lp/hot-tub-offer/step/6" "${WORK_DIR}/step-6.html" "${WORK_DIR}/step-6.headers"
grep -q "Verifying your profile" "${WORK_DIR}/step-6.html"
grep -q "Checking service availability" "${WORK_DIR}/step-6.html"

post_step 6 "/lp/hot-tub-offer/step/7"
get_page "/lp/hot-tub-offer/step/7" "${WORK_DIR}/step-7.html" "${WORK_DIR}/step-7.headers"
grep -q "Great News — You Qualify" "${WORK_DIR}/step-7.html"
grep -q "Where should the local showroom team" "${WORK_DIR}/step-7.html"

post_step 7 "/lp/hot-tub-offer/thank-you" \
  --data-urlencode "firstName=Smoke" \
  --data-urlencode "lastName=Test" \
  --data-urlencode "phone=${SMOKE_PHONE}" \
  --data-urlencode "email=${SMOKE_EMAIL}" \
  --data-urlencode "consent=accepted" \
  --data-urlencode "website="

get_page "/lp/hot-tub-offer/thank-you" "${WORK_DIR}/thank-you.html" "${WORK_DIR}/thank-you.headers"
grep -q "Your request is in" "${WORK_DIR}/thank-you.html"
grep -q '"eventName":"Lead"' "${WORK_DIR}/thank-you.html"
grep -q "generate_lead" "${WORK_DIR}/thank-you.html"
grep -q "Within 30 days" "${WORK_DIR}/thank-you.html"

get_page "/lp/hot-tub-offer/thank-you" "${WORK_DIR}/thank-you-refresh.html" "${WORK_DIR}/thank-you-refresh.headers"
if grep -q '"eventName":"Lead"' "${WORK_DIR}/thank-you-refresh.html"; then
  echo "Conversion event was present on thank-you refresh." >&2
  exit 1
fi
if grep -q "generate_lead" "${WORK_DIR}/thank-you-refresh.html"; then
  echo "Google conversion event was present on thank-you refresh." >&2
  exit 1
fi

curl --fail --silent --show-error \
  --cookie-jar "${OUTSIDE_COOKIE_JAR}" \
  --output /dev/null \
  "${BASE_URL}/lp/hot-tub-offer/step/1"
curl --silent --show-error \
  --cookie "${OUTSIDE_COOKIE_JAR}" \
  --cookie-jar "${OUTSIDE_COOKIE_JAR}" \
  --dump-header "${WORK_DIR}/outside-post.headers" \
  --output /dev/null \
  --request POST \
  --header "Origin: ${BASE_URL}" \
  --data-urlencode "zip=99999" \
  "${BASE_URL}/api/funnel/hot-tub-offer/step/1"
grep -Fqi "location: ${BASE_URL}/lp/hot-tub-offer/out-of-area" "${WORK_DIR}/outside-post.headers"
curl --fail --silent --show-error \
  --cookie "${OUTSIDE_COOKIE_JAR}" \
  --output "${WORK_DIR}/out-of-area.html" \
  "${BASE_URL}/lp/hot-tub-offer/out-of-area"
grep -q "outside the current service area" "${WORK_DIR}/out-of-area.html"
if grep -q '"eventName":"Lead"' "${WORK_DIR}/out-of-area.html"; then
  echo "Conversion event leaked onto the out-of-area page." >&2
  exit 1
fi

curl --fail --silent --show-error "${BASE_URL}/robots.txt" | grep -q "Disallow: /lp/"

echo "Local funnel smoke test passed: all seven steps, interstitial, preload runtime, thank-you gating, refresh dedupe, out-of-area routing, and robots policy verified."
