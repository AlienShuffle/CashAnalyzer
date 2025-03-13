#!/usr/bin/bash
bankName=yieldMM
queryFile=$bankName-file.json

# go pull the home page off the yieldFinder app.
curl -sSL https://yieldFinder.app/json | jq . >"$queryFile"
if [ ! -s "$queryFile" ]; then
    echo "Empty $queryFile file."
    exit 1
fi
../lib/MM-update-common-job.sh -b $bankName -stdin "$queryFile" -pubdelay 20 -rundelay 4 "$@"