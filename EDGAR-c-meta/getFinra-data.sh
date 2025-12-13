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
    "--searchFile")
        searchFile="$2"
        #echo "searchFile=$searchFile"
        shift
        ;;
    *)
        echo "Parameter $1 ignored"
        shift
        ;;
    esac
    shift
done

if [ -z "$searchFile" ]; then
    echo "missing --searchFile argument"
    exit 1
fi

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
tmpFile="$searchFile.tmp.json"

curl --header 'Accept:application/json, text/plain, */*' \
    --header "$curlAgentHeader" \
    --header 'Content-Type: application/json;charset=utf-8' \
    --header "X-Csrf-Token: $csrf" \
    --header "Referer: https://tools.finra.org/fund_analyzer/search" \
    -b $cookies \
    --data "$searchFile" \
    -sSL "https://tools.finra.org/fa_api/search/funds" | #tee raw.json |
    node ./node-process-finra.js | jq . >"$tmpFile"
#jq . <raw.json >raw.jq.json
#wc ../data/finra.json $tmpFile raw.json raw.jq.json
if [ ! -s "$tmpFile" ]; then
    echo "Empty $tmpFile file."
    exit 1
fi
node ../lib/node-mergeFinra.js "$tmpFile" <"$finraFile" | jq . >finra.merge.json
#wc finra.merge.json
#echo stopping for testing
#exit 0
if ../bin/jsonDifferent.sh finra.merge.json "$finraFile"; then
    cat finra.merge.json >"$finraFile"
    echo $finraFile updated.
else
    echo no change
fi
rm -f $tmpFile finra.merge.json raw.jq.json raw.json
