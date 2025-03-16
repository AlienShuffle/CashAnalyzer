#!/usr/bin/bash
bankName=yieldMM
../lib/MM-update-common-job.sh \
    -b $bankName \
    -collectionScript ./collectionScript.sh \
    -pubdelay 20 -rundelay 4 "$@"