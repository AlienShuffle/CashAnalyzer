#!/usr/bin/bash

# run force mode as the collection script throttles itself to avoid hitting API limits.
../bin/ETF-facts-update-common-job.sh \
    --collectionScript ./collectionScript-facts.sh \
    -f "$@"

# dated-list.txt created by the collection script above, just use to decide if we found anything
# then delete. It was used in the flow above, but is transient.
tickerCnt=$(wc -l <dated-list.txt)
rm -f dated-list.txt
[ $tickerCnt -gt 0 ] || exit 0

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
            echo $ticker | ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" -f "$@"
        done
fi
