#!/usr/bin/bash
../bin/MM-update-common-job.sh \
    --collectionScript ../bin/mmFunCollectionScript.sh \
    --processScript ../lib/node-mmFun-update.js \
    --pubDelay 20 --runDelay 4 "$@"
