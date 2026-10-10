#!/usr/bin/bash
#
# Pull the driver JSON file from the bloxx website with links and overview info about all funds.
# We will parse this for details to drive a fuller fund by fund report in the node script...
#
curlFile=$(mktemp) || exit 1
trap 'rm -f "$curlFile"' EXIT
curl -sSL "https://bondbloxxetf.com/products/?suite=treasuries" >"$curlFile" || exit 1
node ./node-list-parse.js ./bloxx-ETFs.csv <"$curlFile" >links.json || exit 1
jq . links.json
