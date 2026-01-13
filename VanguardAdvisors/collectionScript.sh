#!/usr/bin/bash
# go pull the vanguard.com funds month-end reports page off the vanguard.com and return only the json portion.

cat ./VanguardETF-funds.txt |
    while read -r ticker; do
        [ -d "./downloads/$ticker" ] || mkdir -p "./downloads/$ticker"
        echo $ticker
    done |
    node ./node-vtec-scrape.js | jq .

