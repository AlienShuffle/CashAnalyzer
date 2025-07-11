#!/usr/bin/bash
# script pulls the list of funds from finra.org to provide display names, expense ratio, etc..
#
# process the command argument list.
pubDelayHours=24
runDelayHours=24
while [ -n "$1" ]; do
    case $1 in
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "--pubDelay")
        pubDelayHours="$2"
        #echo "pubDelayHours=$pubDelayHours"
        shift
        ;;
    "--runDelay")
        runDelayHours="$2"
        #echo "runDelayHours=$runDelayHours"
        shift
        ;;
    *)
        echo "Parameter $1 ignored"
        shift
        ;;
    esac
    shift
done
# computer-specific configurations.
source ../meta.$(hostname).sh

pubDelayFile=""
runDelayFile="$finraFile"
source ../bin/testDelays.sh

cookies=finra.cookie.jar.txt
#
# create a session cookie.
#
curl --header 'Accept:*/*' \
    --header 'Accept-Encoding:gzip, deflate, br' \
    --header 'User-Agent:retiringw@gmail.com/0.0.1' \
    -sSL "https://tools.finra.org/api/csrf/token" \
    -c $cookies >/dev/null
csrf=$(grep CSRF-TOKEN $cookies | cut -f7)
#
# pull a full list of funds from the query.
#
curl --header 'Accept:application/json, text/plain, */*' \
    --header "$curlAgentHeader" \
    --header 'Content-Type: application/json;charset=utf-8' \
    --header "X-Csrf-Token: $csrf" \
    --header "Referer: https://tools.finra.org/fund_analyzer/search" \
    -b $cookies \
    --data @finra.content.json \
    -sSL "https://tools.finra.org/fa_api/search/funds" | tee |
    node ./node-process-finra.js | jq . >finra.tmp.json

if [ ! -s "finra.tmp.json" ]; then
    echo "Empty finra.tmp.jason file."
    exit 1
fi
if ../bin/jsonDifferent.sh finra.tmp.json "$finraFile"; then
    cat finra.tmp.json >"$finraFile"
    echo $finraFile updated.
fi
rm -f finra.tmp.json
