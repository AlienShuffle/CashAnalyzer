#!/usr/bin/bash

# takes one row input on stdin: ticker,fundId,dwnldId,fundName
# pulls distribution data from BlackRock for the given ticker.
# parses into JSON and outputs on stdout.

source ../meta.$(hostname).sh
IFS= read -r row
ticker=$(echo $row | cut -d, -f1 | tr -d '"')
url=$(echo $row | cut -d, -f2 | tr -d '"')

[ -z "$ticker" ] && exit 1
#echo $ticker 1>&2
#echo $url 1>&2
curl -sSL $url | #tee "curl.${ticker}.json" |
    node ./node-BlackRock-distro-update.js "$ticker" |
    jq .
