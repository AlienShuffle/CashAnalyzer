#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" |
    ../bin/MM-update-common-job.sh \
        --collectionScript ./inst-collectionScript.sh \
        --processScript ../lib/node-inst-Vanguard-Price-Yield.js \
        --pubDelay 8 --runDelay 2 \
        --nightDelayHour 4 "$@"
