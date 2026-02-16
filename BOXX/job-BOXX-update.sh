#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.

[ -d "history/BOXX" ] || mkdir -p "history/BOXX"

../bin/MM-update-common-job.sh \
    --accountClass Funds \
    --processScript ./node-BOXX-yield-update.js \
    --pubDelay 18 --runDelay 4 -f "$@"

../bin/ETF-distro-update-common-job.sh --ticker "BOXX" "$@"
exit 0

cat history/BOXX-rate-new.json |
    jq -r '.[] | [.ticker,.baseUrl] | @csv' |
    while IFS= read -r fundReference; do
        ticker=$(echo "$fundReference" | cut -d, -f1 | tr -d '"')
        echo "Processing BOXX facts"
        echo "$fundReference" |
            ../bin/ETF-facts-update-common-job.sh --nodeArg "BOXX" "$@"
    done
