#!/usr/bin/bash
../bin/MM-update-common-job.sh \
    --collectionScript ./collectionScript.sh \
    --processScript ./node-BlackRock-update.js \
    --pubDelay 20 --runDelay 2 "$@"
