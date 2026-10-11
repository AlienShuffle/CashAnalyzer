#!/usr/bin/bash
tickerFile=$(mktemp) || exit 1
trap 'rm -f "$tickerFile"' EXIT
printf 'FTEXX\n' >"$tickerFile" || exit 1
../bin/MM-update-common-job.sh \
    --collectionScript ../cnbc/cnbcCollectionScript.sh \
    --collectionArg "$tickerFile" \
    --processScript ../lib/node-echo.js \
    --pubDelay 20 --runDelay 4 "$@"
