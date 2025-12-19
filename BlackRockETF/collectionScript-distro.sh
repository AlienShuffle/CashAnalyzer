#!/usr/bin/bash

# takes one row input on stdin: ticker,fundId,dwnldId,fundName
# pulls distribution data from BlackRock for the given ticker.
# parses into JSON and outputs on stdout.

source ../meta.$(hostname).sh
IFS= read -r row
ticker=$(echo $row | cut -d, -f1)
fundId=$(echo $row | cut -d, -f2)
dwnldId=$(echo $row | cut -d, -f3)
fundName=$(echo $row | cut -d, -f4)
[ -z "$ticker" ] && exit 1
#echo $ticker 1>&2
url="https://www.ishares.com/us/products/$fundId/fund/$dwnldId.ajax?fileType=xls&fileName=${fundName}_fund&dataType=fund"
#echo $url 1>&2
curl -sSL --header "$curlAgentHeader" "$url" | # tee "curl.${ticker}.json" |
    node ./node-parse-BlackRock-distributions.js "$ticker" |
    jq .
