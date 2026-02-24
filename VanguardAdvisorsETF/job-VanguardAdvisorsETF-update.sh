#!/usr/bin/bash

../bin/ETF-facts-update-common-job.sh \
    --collectionScript ./collectionScript-facts.sh \
    --processScript ../lib/node-echo.js \
    "$@"

factsFile="history/VanguardAdvisorsETF-facts-new.json"
if [ -f "$factsFile" ]; then
    cat $factsFile |
        ../bin/MM-update-common-job.sh \
            --accountClass Funds \
            --processScript ../lib/node-filter-yield-attrs.js \
            --pubDelay 16 --runDelay 4 "$@"

    # still need to build the basic model for this, so skipping the distro update for now.
    cat $factsFile |
        jq -r '.[] | [.ticker] | @csv' | tr -d '"' |
        while IFS= read -r ticker; do
            distroFile="downloads/$ticker/$ticker-distributions.csv"
            [ -f "$distroFile" ] || continue    
            echo "Processing $ticker distributions"
            echo $ticker | ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" "$@"
        done
fi
