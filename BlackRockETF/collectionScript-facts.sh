#!/usr/bin/bash

# takes one row input on stdin: ticker,fundUrl
# pulls facts data page from BlackRock for the given ticker.
# and sends forward the HTML to stdout.
# this is needed if I need to add the Agent header to the curl command.
#source ../meta.$(hostname).sh
IFS= read -r row
ticker=$(echo $row | cut -d, -f1 | tr -d '"')
url=$(echo $row | cut -d, -f2 | tr -d '"')

[ -z "$ticker" ] && exit 1
#echo $ticker 1>&2
#echo $url 1>&2
curl -sSL $url | #tee "curl.${ticker}.json" |
