#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" | ../bin/MM-update-common-job.sh \
    --collectionScript ./cnbcCollectionScript.sh \
    --processScript ../lib/node-echo.js \
    --pubDelay 20 --runDelay 4 "$@"
