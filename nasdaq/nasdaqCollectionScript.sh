#!/usr/bin/bash
# computer-specific configurations.
source ../meta.$(hostname).sh
#
# Pull a recent history report for each mmFun fund and assemble a json array to feed into the processor.
#
(
    firstRow=true
    echo "["
    # note, this cut is reading from stdin and expects a csv list of fund ticker, ticker, names to drive the queries.
    while IFS= read -r ticker; do
        [ "$firstRow" = "false" ] && echo ","
        echo "{ \"ticker\": \"$ticker\", \"yields\": "
        curl --header "$curlAgentHeader" \
            -sSL "https://api.nasdaq.com/api/quote/$(echo $ticker | tr '[:upper:]' '[:lower:]')/summary?assetclass=mutualfunds"
        echo "}"
        firstRow=false
    done
    echo "]"
) | jq .
