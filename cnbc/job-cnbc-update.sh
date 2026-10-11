#!/usr/bin/bash
../bin/MM-update-common-job.sh \
    --collectionScript ../cnbc/cnbcCollectionScript.sh \
    --collectionArg "$(basename "$(pwd)")-funds.csv" \
    --processScript ../lib/node-echo.js \
    --pubDelay 20 --runDelay 4 --nightDelayHour 3 "$@"
