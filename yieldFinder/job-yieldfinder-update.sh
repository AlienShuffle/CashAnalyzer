#!/usr/bin/bash
queryFile=yieldFinder-file.json
jsonFile=yieldFinder-results.json

# go pull the home page off the yieldFinder app.
curl -sSL https://yieldFinder.app/json >"$queryFile"
if [ ! -s "$queryFile" ]; then
    echo "Empty $queryFile file."
    exit 1
fi
../lib/Bank-update-common-job.sh -b $(basename $(pwd)) -stdin "$queryFile" -pubdelay 20 -rundelay 4 "$@"
