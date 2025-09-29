#!/usr/bin/bash
cat "$(basename $(pwd))-funds-partial.csv" |
    ../bin/MM-update-common-job.sh \
        --collectionScript ./inst-collectionScript.sh \
        --processScript ./node-inst-VanguardPrices-update.js \
        --pubDelay 20 --runDelay 2 "$@"
