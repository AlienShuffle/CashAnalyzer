#!/usr/bin/bash
../bin/MM-update-common-job.sh \
    --collectionScript ../bin/fidoCollectionScript.sh \
    --processScript ../lib/node-FidelityMM-update.js \
    --pubDelay 6 --runDelay 5 "$@"
