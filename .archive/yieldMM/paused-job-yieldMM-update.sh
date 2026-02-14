#!/usr/bin/bash
../bin/MM-update-common-job.sh \
    --collectionScript ./collectionScript.sh \
    --pubDelay 20 --runDelay 4 "$@"
