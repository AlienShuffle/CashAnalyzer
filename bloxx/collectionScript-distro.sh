#!/usr/bin/bash
source ../meta.common.sh
IFS= read -r row
ticker=$(echo $row | cut -d, -f1 | tr -d '"')
url=$(echo $row | cut -d, -f2 | tr -d '"')
[ -z "$ticker" ] && exit 1
#echo $ticker 1>&2
#echo $url 1>&2
curl -sSL $url | # tee "curl.${ticker}.html" |
    node ./node-bloxx-distro-update.js "$ticker" |
    jq .