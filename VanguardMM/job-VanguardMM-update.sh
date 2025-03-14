#!/usr/bin/bash
bankName=$(basename $(pwd))
queryFile=$bankName-file.json

# go pull the vanguard.com funds month-end reports page off the vanguard.com.
curl -sSL --referer 'https://investor.vanguard.com' "https://api.vanguard.com/rs/ire/01/ind/mf/month-end.jsonp?" |
    sed -e 's/^callback(//' |
    sed -e 's/)$//' |
    jq '.fund.entity' >"$queryFile"
if [ ! -s "$queryFile" ]; then
    echo "Empty $queryFile file."
    exit 1
fi
../lib/MM-update-common-job.sh -b $bankName -stdin "$queryFile" -pubdelay 20 -rundelay 4 "$@"