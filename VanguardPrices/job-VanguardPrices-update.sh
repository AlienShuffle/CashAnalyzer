#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" |
    ../bin/MM-update-common-job.sh \
        --collectionScript ./collectionScript.sh \
        --processScript ./node-VanguardPrices-update.js \
        --pubDelay 20 --runDelay 4 "$@"
