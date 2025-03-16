#!/usr/bin/bash
bankName=$(basename $(pwd))
../bin/MM-update-common-job.sh -b $bankName -collectionScript ./collectionScript.sh -pubdelay 20 -rundelay 4 "$@"