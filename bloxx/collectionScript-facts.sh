#!/usr/bin/bash
#
# Pull the driver JSON file from the bloxx website with link and overview info about all funds.
# We will parse this for details to drive a filter fund by fund report in the node script...
#
#echo "running bloxx fundlist query" 1>&2
curl -sSL "https://bondbloxxetf.com/products/?suite=treasuries" |
    node ./node-list-parse.js |
    tee links.json |
    jq .
