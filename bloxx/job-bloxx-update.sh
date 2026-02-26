#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.

../bin/ETF-facts-update-common-job.sh \
    --collectionScript ./collectionScript-facts.sh --nodeArg bloxx-ETFs.csv "$@"

factsFile="history/bloxx-facts-new.json"
if [ -f "$factsFile" ]; then
    cat $factsFile |
        ../bin/MM-update-common-job.sh \
            --accountClass Funds \
            --processScript ../lib/node-filter-yield-attrs.js \
            -f "$@"
fi
exit 1
cat bloxx-ETFs.csv |
    while IFS= read -r ticker; do
        echo "$ticker" |
            ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" "$@"
    done
