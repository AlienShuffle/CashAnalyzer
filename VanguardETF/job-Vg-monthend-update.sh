#!/usr/bin/bash
../bin/MM-update-common-job.sh \
    --collectionScript ./collectionScript.sh \
    --accountClass Funds \
    --processScript ./node-Vg-monthend-update.js \
    --nodeArg ./VanguardETF-funds.txt \
    --pubDelay 20 --runDelay 4 "$@"