#!/usr/bin/bash
../bin/Bank-update-common-job.sh \
    --collectionScript ./collectionScript.sh \
    --pubDelay 20 --runDelay 4 \
    --nightDelayHour 3 "$@"