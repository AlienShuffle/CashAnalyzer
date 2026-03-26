#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" | ../bin/MM-update-common-job.sh \
    --collectionScript ../cnbc/cnbcCollectionScript.sh \
    --processScript ../lib/node-echo.js \
    --pubDelay 20 --runDelay 4 --nightDelayHour 3 "$@"
