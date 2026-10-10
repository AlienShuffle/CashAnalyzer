#!/usr/bin/bash
source ../meta.common.sh
source ../bin/nodeJobUtils.sh
IFS= read -r row
ticker=$(echo $row | cut -d, -f1 | tr -d '"')
url=$(echo $row | cut -d, -f2 | tr -d '"')
[ -z "$ticker" ] && exit 1
#echo $ticker 1>&2
#echo $url 1>&2
curlFile=$(mktemp) || exit 1
trap 'rm -f "$curlFile"' EXIT
curl -sSL $url >"$curlFile" || exit 1
nodeJson "$curlFile" ./node-bloxx-distro-update.js "$ticker"
