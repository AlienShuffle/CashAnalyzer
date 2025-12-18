#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" | ../bin/MM-update-common-job.sh \
    --collectionScript ./markitCollectionScript.sh \
    --processScript ./node-flatten-yields.js \
    --pubDelay 20 --runDelay 4 "$@"
