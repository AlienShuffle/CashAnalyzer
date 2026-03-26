#!/usr/bin/bash
#cat "$(basename $(pwd))-funds.csv"
echo FTEXX | ../bin/MM-update-common-job.sh \
    --collectionScript ../cnbc/cnbcCollectionScript.sh \
    --processScript ../lib/node-echo.js \
    --pubDelay 20 --runDelay 4 "$@"
