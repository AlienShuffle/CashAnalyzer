#!/usr/bin/bash
queryFile=yieldFinder-results.html
jsonFile=yieldFinder-results.json

# go pull the home page off the yieldFinder app.
curl -sSL https://yieldFinder.app >"$queryFile"
if [ ! -s "$queryFile" ]; then
    echo "Empty $queryFile file."
    exit 1
fi
asOfDate=$(grep '<span>Rates as of ' "$queryFile" |
    sed -e 's/ *<span>Rates as of *//' |
    sed -e 's/ *\/\/ .*<\/span> *//')
if [ -z "$asOfDate" ]; then
    echo "Empty asOfDate query."
    exit 1
fi
tr -d '\n' <"$queryFile" |
    sed -e 's/^.*const jsData = {/{/' |
    sed -e 's/};.*$/}/' >"$jsonFile"
if [ ! -s "$jsonFile" ]; then
    echo "Empty $jsonFile file."
    exit 1
fi
../lib/Bank-update-common-job.sh -b $(basename $(pwd)) -stdin "$jsonFile" -nodearg "$asOfDate" -pubdelay 20 -rundelay 6 "$@"
