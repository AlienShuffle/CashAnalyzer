#!/usr/bin/bash
#
# Pull the driver JSON file from the bloxx website with links and overview info about all funds.
# We will parse this for details to drive a fuller fund by fund report in the node script...
#
curl -sSL "https://bondbloxxetf.com/products/?suite=treasuries" |
    node ./node-list-parse.js ./bloxx-ETFs.csv |
    tee links.json |
    jq .
