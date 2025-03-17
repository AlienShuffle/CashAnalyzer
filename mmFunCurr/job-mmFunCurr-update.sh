#!/usr/bin/bash
../bin/MM-update-common-job.sh \
    --collectionScript ./mmFunCurrCollectionScript.sh \
    --processScript ./node-mmFunCurr-update.js \
    --nodeArg mmFunCurr-funds.txt \
    --pubDelay 20 --runDelay 4 "$@"
