#!/usr/bin/bash
queryFile=yieldFinder-file.json
bankName=$(basename $(pwd))

# go pull the home page off the yieldFinder app.
curl -sSL https://yieldFinder.app/json | jq . >"$queryFile"
if [ ! -s "$queryFile" ]; then
    echo "Empty $queryFile file."
    exit 1
fi
../bin/Bank-update-common-job.sh -b $bankName -stdin "$queryFile" -pubdelay 20 -rundelay 4 "$@"