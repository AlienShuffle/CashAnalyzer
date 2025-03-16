#!/usr/bin/bash
#
# Pull a recent history report for each fido fund and assemble a json array to feed into the processor.
#
(
    firstRow=true
    echo "["
    # note, this cut is reading from stdin and expects a csv list of fund ticker, fundID, names to drive the queries.
    cut -d, -f2 |
        while IFS= read -r fundId; do
            [ "$firstRow" = "false" ] && echo ","
            curl -sSL "https://institutional.fidelity.com/app/fund/data/$(echo $fundId).json"
            firstRow=false
        done
    echo "]"
) | jq .
