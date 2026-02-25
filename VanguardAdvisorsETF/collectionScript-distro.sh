#!/usr/bin/bash
#
# Takes one line of input on stdin for the ticker to process.
# Pulls distribution data from the downloads directory for the given ticker.
# Parses into JSON and outputs on stdout for handling by the calling script.

IFS= read -r ticker
[ -z "$ticker" ] && exit 1
file="downloads/$ticker/$ticker-distributions.csv"
[ -f "$file" ] || exit 1
cat "$file" |
    node ./node-VanguardAdvisorsETF-distro-update.js "$ticker" |
    jq .
