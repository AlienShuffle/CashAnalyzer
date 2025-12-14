#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" |
    ../bin/MM-update-common-job.sh \
        --collectionScript ./inst-collectionScript.sh \
        --processScript ../lib/node-inst-Vanguard-Yield.js \
        --pubDelay 20 --runDelay 2 --collectionArg "2022" -f "$@"
