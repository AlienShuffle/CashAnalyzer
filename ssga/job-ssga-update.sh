#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.

../bin/ETF-facts-update-common-job.sh \
    --collectionScript ./collectionScript-facts.sh --nodeArg ssga-ETFs.csv "$@"

factsFile="history/ssga-facts-new.json"
if [ -f "$factsFile" ]; then
    cat $factsFile |
        ../bin/MM-update-common-job.sh \
            --accountClass Funds \
            --processScript ../lib/node-filter-yield-attrs.js \
            -f "$@"
fi

cat ssga-ETFs.csv |
    while IFS= read -r ticker; do
        echo "$ticker" |
            ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" "$@"
    done
