#!/usr/bin/bash
source ../meta.$(hostname).sh
../bin/MM-update-common-job.sh \
    --collectionScript ./mmFunCurrCollectionScript.sh \
    --processScript ./node-mmFunCurr-update.js \
    --nodeArg "$fundsList" \
    --pubDelay 20 --runDelay 4 "$@"
