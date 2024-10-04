#!/usr/bin/bash
queryFile=yieldFinder-results.html
asOfFile=yieldFinder-asOfDate.txt
jsonFile=yieldFinder-results.json

# go pull the home page off the yieldFinder app.
curl -sSL https://yieldFinder.app >"$queryFile"
if [ ! -s "$queryFile" ]; then
    echo "Empty $queryFile file."
    exit 1
fi
asOfDate=$(grep '<p>Rates as of ' yieldFinder-results.html |
    sed -e 's/ *<p>Rates as of *//' |
    sed -e 's/ *\/\/ .*<\/p> *//')
if [ -z "$asOfDate" ]; then
    echo "Empty asOfDate query."
    exit 1
fi
grep 'const jsData = {\"moneyMarketFunds\":' "$queryFile" |
    sed -e 's/const jsData =//' |
    sed -e 's/;$//' >"$jsonFile"
if [ ! -s "$jsonFile" ]; then
    echo "Empty $jsonFile file."
    exit 1
fi
../lib/Bank-update-common-job.sh -b $(basename $(pwd)) -stdin "$jsonFile" -nodearg "$asOfDate" -pubdelay 20 -rundelay 6 "$@"
