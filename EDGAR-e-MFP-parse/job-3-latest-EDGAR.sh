#!/usr/bin/bash
# process the command argument list.
pubDelayHours=48
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

jsonNew="history/latestEDGAR.json"
jsonFlare="$cloudFlareHome/EDGAR/latestEDGAR.json"
csvFlare="$cloudFlareHome/EDGAR/latestEDGAR.csv"
csvSummaryFlare="$cloudFlareHome/EDGAR/latestEDGAR-summary.csv"
pubDelayFile="$jsonFlare"
runDelayFile="$jsonNew"
source ../bin/testDelays.sh

#
# Pull a recent history report for each mmFun fund and assemble a json array to feed into the processor.
#
(
    firstRow=true
    echo "["
    # note, this cut is reading from stdin and expects a csv list of fund ticker, ticker, names to drive the queries.
    for ticker in $(find tickers/*.json -size +5b -print); do
        [ "$firstRow" = "false" ] && echo ","
        jq '.[0]' <$ticker
        firstRow=false
    done
    echo "]"
) | jq . >"$jsonNew"

if ../bin/jsonDifferent.sh "$jsonNew" "$jsonFlare"; then
    cat "$jsonNew" >"$jsonFlare"
    ./exportEDGARcsv.sh "$jsonFlare" >"$csvFlare"
    ./exportEDGAR-summary-csv.sh "$jsonFlare" >"$csvSummaryFlare"
    echo "$jsonFlare updated (csv too)."
fi
