#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" | ../bin/MM-update-common-job.sh \
    --collectionScript ./nasdaqCollectionScript.sh \
    --processScript ./node-nasdaq-update.js \
    --pubDelay 20 --runDelay 4 "$@"
