#!/usr/bin/bash
../bin/MM-update-common-job.sh \
    --collectionScript ./collectionScript.sh \
    --pubDelay 16 --runDelay 4 "$@"
