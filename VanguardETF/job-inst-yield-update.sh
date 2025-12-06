#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" |
    ../bin/MM-update-common-job.sh \
        --accountClass Funds \
        --collectionScript ../VanguardPrices/inst-collectionScript.sh \
        --processScript ../lib/node-inst-Vanguard-Price-Yield.js \
        --pubDelay 20 --runDelay 2  -f "$@"
# use this argument to run earlier time periods
# --collectionArg "2024"