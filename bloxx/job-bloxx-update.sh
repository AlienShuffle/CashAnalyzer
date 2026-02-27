#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.
../bin/ETF-facts-update-common-job.sh \
    --collectionScript ./collectionScript-facts.sh --nodeArg bloxx-ETFs.csv "$@"

linksFile=links.json    
if [ -f $linksFile ]; then
    cat $linksFile |
        jq -r '.[] | [.ticker,.url] | @csv' | tr -d '"' | # tee tickerAndUrls.csv |
        while IFS= read -r fundReference; do
            ticker=$(echo "$fundReference" | cut -d, -f1 | tr -d '"')
            echo "$fundReference" |
                ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" "$@"
        done
#else
#    echo $linksFile: missing!
fi

factsFile="history/bloxx-facts-new.json"
if [ -f "$factsFile" ]; then
    cat $factsFile |
        ../bin/MM-update-common-job.sh \
            --accountClass Funds \
            --processScript ../lib/node-filter-yield-attrs.js \
            -f "$@"
else
    echo $factsFile: missing
fi
rm -f $linksFile
