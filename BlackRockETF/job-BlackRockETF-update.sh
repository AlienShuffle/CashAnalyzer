#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.
../bin/MM-update-common-job.sh \
    --accountClass Funds \
    --collectionScript ./collectionScript-yields.sh \
    --processScript ./node-BlackRock-yield-update.js \
    --nodeArg "BlackRock-ETFs.csv" \
    --pubDelay 18 --runDelay 4 -f "$@"

cat history/BlackRockETF-rate-new.json |
    jq -r '.[] | [.ticker,.distroUrl] | @csv' |
    while IFS= read -r fundReference; do
        ticker=$(echo "$fundReference" | cut -d, -f1 | tr -d '"')
        echo "Processing $ticker distributions"
        echo "$fundReference" |
            ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" "$@"
    done
exit 1
cat history/BlackRockETF-rate-new.json |
    jq -r '.[] | [.ticker,.baseUrl] | @csv' |
    while IFS= read -r fundReference; do
        ticker=$(echo "$fundReference" | cut -d, -f1 | tr -d '"')
        echo "Processing $ticker facts"
        echo "$fundReference" |
            ../bin/ETF-facts-update-common-job.sh --nodeArg "$ticker" "$@"
    done