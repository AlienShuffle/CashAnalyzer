#!/usr/bin/bash

# takes one file input on stdin: ticker
# pulls distribution data from the downloads directory for the given ticker.
# parses into JSON and outputs on stdout.

IFS= read -r ticker
[ -z "$ticker" ] && exit 1
file="downloads/$ticker/$ticker-distributions.csv"
[ -f "$file" ] || exit 1
cat "$file" |
    node ./node-VanguardAdvisorsETF-distro-update.js "$ticker" |
    jq .
