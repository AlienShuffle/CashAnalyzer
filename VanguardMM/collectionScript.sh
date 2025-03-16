#!/usr/bin/bash
bankName=$(basename $(pwd))
queryFile=$bankName-file.json

# go pull the vanguard.com funds month-end reports page off the vanguard.com.
curl -sSL --referer 'https://investor.vanguard.com' "https://api.vanguard.com/rs/ire/01/ind/mf/month-end.jsonp?" |
    sed -e 's/^callback(//' |
    sed -e 's/)$//' |
    jq '.fund.entity' >"$queryFile"
if [ ! -s "$queryFile" ]; then
    echo "Empty $queryFile file." >&2
    exit 1
fi
cat "$queryFile"