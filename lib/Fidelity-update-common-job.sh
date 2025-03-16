#!/usr/bin/bash
bankName=$(basename $(pwd))
queryFile=$bankName-file.json
#
# Pull a recent history report for each fido fund and assemble a json array to feed into the processor.
#
(
    firstRow=true
    echo "["
    # note, this cut is reading from stdin and expects a csv list of fund ticker, fundID, names to drive the queries.
    cut -d, -f2 |
        while IFS= read -r fundId; do
            if [ "$firstRow" = "false" ]; then
                echo ","
            fi
            curl -sSL "https://institutional.fidelity.com/app/fund/data/$(echo $fundId).json"
            firstRow=false
        done
    echo "]"
) | jq . >"$queryFile"
../lib/MM-update-common-job.sh -scriptFile ../lib/node-FidelityMM-update.js -b $bankName -stdin "$queryFile" -pubdelay 20 -rundelay 4 "$@"