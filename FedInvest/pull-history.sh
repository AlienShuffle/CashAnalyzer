#!/usr/bin/bash
set -euo pipefail

if [ "$#" -ne 1 ] || [[ ! "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Usage: $0 YYYY-MM-DD" >&2
    exit 1
fi
reportDate="$1"
if ! normalizedDate=$(date -d "$reportDate" +%F) || [ "$normalizedDate" != "$reportDate" ]; then
    echo "Invalid FedInvest report date: $reportDate" >&2
    exit 1
fi

cd "$(dirname "$(readlink -f "$0")")"
mkdir -p history
work=$(mktemp -d "$PWD/history/.pull-history.XXXXXX")
trap 'rm -f "$work/quotes.csv" "$work/rate.json" "$work/rate.csv"; rmdir "$work"' EXIT

echo "Fetching FedInvest quotes for $reportDate"
bash ./collect-FedInvest.sh "$reportDate" >"$work/quotes.csv"
node ../lib/node-FedInvest-update.js --input "$work/quotes.csv" --output "$work/rate.json"
if ! jq -e --arg date "$reportDate" '
    type == "array" and length > 0 and
    all(.[];
        .asOfDate == $date and
        (.cusip | type == "string" and test("^[A-Z0-9]{9}$")) and
        (.securitytype | type == "string" and length > 0) and
        (.maturitydate | type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")) and
        (.rate | tonumber >= 0) and (.endofday | tonumber >= 0) and
        (.buy == "" or (.buy | tonumber >= 0)) and
        (.sell == "" or (.sell | tonumber >= 0))
    ) and ([.[].cusip] | length == (unique | length))
' "$work/rate.json" >/dev/null; then
    echo "Invalid, empty or date-mismatched FedInvest quotes for $reportDate; history was not changed." >&2
    exit 1
fi

{
    echo 'asOfDate, cusip, securitytype, rate, maturitydate, calldate, buy, sell, endofday, key'
    jq -r '.[] | [.asOfDate, .cusip, .securitytype, .rate, .maturitydate, .calldate, .buy, .sell, .endofday, .key] | @csv' "$work/rate.json"
} >"$work/rate.csv"

source ../bin/nodeJobUtils.sh
cloudDaily="$HOME/cloudflare/public/Treasuries/FedInvest/daily"
mkdir -p "$cloudDaily"
for extension in json csv; do
    publishFile "$work/rate.$extension" "history/$reportDate-rate.$extension"
    publishFile "$work/rate.$extension" "$cloudDaily/$reportDate-rate.$extension"
done
echo "Saved FedInvest $reportDate quotes in $PWD/history and $cloudDaily. Latest quotes were not changed."
