#!/usr/bin/bash
bankName=$(basename $(pwd))
queryFile=$bankName-file.json
../lib/MM-update-common-job.sh -b $bankName -collectionScript ./collectionScript.sh -pubdelay 20 -rundelay 4 "$@"