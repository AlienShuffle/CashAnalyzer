#!/usr/bin/bash
#
# Takes one line of input on stdin for the ticker to process.
# Pulls distribution data from the downloads directory for the given ticker.
# Parses into JSON and outputs on stdout for handling by the calling script.

IFS= read -r ticker
[ -z "$ticker" ] && exit 1
# Prefer the captured fund API data; fall back to the CSV export when it is unavailable.
jsonFile="downloads/$ticker/$ticker-distributions.json"
csvFile="downloads/$ticker/$ticker-distributions.csv"
if [ -s "$jsonFile" ]; then
    file="$jsonFile"
elif [ -s "$csvFile" ]; then
    file="$csvFile"
else
    exit 1
fi
cat "$file" |
    node ./node-VanguardAdvisorsETF-distro-update.js "$ticker" |
    jq .
