#!/usr/bin/bash
#
# Pull a recent history report for each mmFun fund and assemble a json array to feed into the processor.
#
(
    firstRow=true
    echo "["
    # note, this cut is reading from stdin and expects a csv list of fund ticker, ticker, names to drive the queries.
    while IFS= read -r ticker; do
        curl -sSL "https://moneymarket.fun/data/$(echo $ticker | tr '[:upper:]' '[:lower:]')/fundYield.json" >tmp.json
        if grep '<!DOCTYPE html><html' tmp.json >/dev/null; then
            # file is a 404 error, skip it.
            continue
        fi
        [ "$firstRow" = "false" ] && echo ","
        echo "{ \"ticker\": \"$ticker\", \"yields\": "
        cat tmp.json
        echo "}"
        firstRow=false
    done
    echo "]"
) | jq .
rm -f tmp.json
