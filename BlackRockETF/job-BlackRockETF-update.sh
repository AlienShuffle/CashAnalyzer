#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.
../bin/MM-update-common-job.sh \
    --accountClass Funds \
    --collectionScript ./collectionScript-yields.sh \
    --nodeArg "BlackRock-ETFs.csv" \
    --pubDelay 18 --runDelay 4 -f "$@"

cat history/BlackRockETF-rate-new.json |
    jq -r '.[] | [.ticker,.distroUrl] | @csv' |
    while IFS= read -r fundReference; do
        ticker=$(echo "$fundReference" | cut -d, -f1 | tr -d '"')
        echo "$fundReference" |
            ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" "$@"
    done

cat history/BlackRockETF-rate-new.json |
    jq -r '.[] | [.ticker,.baseUrl] | @csv' | tr -d '"' | tee tickerAndUrls.csv |
    ../bin/ETF-facts-update-common-job.sh "$@"
