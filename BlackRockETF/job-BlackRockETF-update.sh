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

if ! jq -r '.[] | [.ticker,.baseUrl,.asOfDate,.thirtyDayYield] | join(",")' \
    history/BlackRockETF-rate-new.json >tickerAndUrls.csv; then
    echo "BlackRockETF failed to prepare facts input, exiting." >&2
    exit 1
fi
if [ ! -s tickerAndUrls.csv ]; then
    echo "Empty BlackRockETF facts input tickerAndUrls.csv, exiting." >&2
    exit 1
fi
../bin/ETF-facts-update-common-job.sh --inputFile tickerAndUrls.csv "$@"
