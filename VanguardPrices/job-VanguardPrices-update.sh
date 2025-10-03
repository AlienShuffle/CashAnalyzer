#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" |
    ../bin/MM-update-common-job.sh \
        --collectionScript ./inst-collectionScript.sh \
        --processScript ./node-inst-VanguardPrices-update.js \
        --pubDelay 8 --runDelay 2 "$@"
