#!/usr/bin/bash

# run force mode as the collection script throttles itself to avoid hitting API limits.
../bin/ETF-facts-update-common-job.sh \
    --collectionScript ./collectionScript-facts.sh \
    --processScript ../lib/node-echo.js \
    -f "$@"

tickerCnt=$(wc -l <dated-list.txt)
[ $tickerCnt -gt 0 ] || exit 0
echo "Collected facts for $tickerCnt tickers. Now updating facts and distributions for all tickers."

factsFile="history/VanguardAdvisorsETF-facts-new.json"
if [ -f "$factsFile" ]; then
    cat $factsFile |
        ../bin/MM-update-common-job.sh \
            --accountClass Funds \
            --processScript ../lib/node-filter-yield-attrs.js \
            -f "$@"

    cat $factsFile |
        jq -r '.[] | [.ticker] | @csv' | tr -d '"' |
        while IFS= read -r ticker; do
            distroFile="downloads/$ticker/$ticker-distributions.csv"
            [ -f "$distroFile" ] || continue
            echo "Processing $ticker distributions"
            echo $ticker | ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" -f "$@"
        done
fi
