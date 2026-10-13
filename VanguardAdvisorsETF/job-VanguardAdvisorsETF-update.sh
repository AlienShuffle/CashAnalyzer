#!/usr/bin/bash

set -e
set -o pipefail
cd "$(dirname "$0")"
# Hold the publishing lock as well as the collector's shared provider lock.
mkdir -p history
exec 9>history/hybrid-job.lock
flock -n 9 || { echo "Vanguard hybrid job already running." >&2; exit 1; }
node ./node-VanguardAdvisorsETF-hybrid-job.mjs

factsFile="history/VanguardAdvisorsETF-facts-new.json"
../bin/ETF-facts-update-common-job.sh \
    --injectProcessedJson "$factsFile" -f "$@"
if [ -f "$factsFile" ]; then
    ../bin/MM-update-common-job.sh \
        --accountClass Funds \
        --processScript ../lib/node-filter-yield-attrs.js \
        --inputFile "$factsFile" \
        -f "$@"

    cat $factsFile |
        jq -r '.[] | [.ticker] | @csv' | tr -d '"' |
        while IFS= read -r ticker; do
            distroJson="downloads/$ticker/$ticker-distributions.json"
            distroCsv="downloads/$ticker/$ticker-distributions.csv"
            jq -e 'type == "array" and length > 0' "$distroJson" >/dev/null || continue
            echo $ticker | ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" -f "$@"
        done
fi
