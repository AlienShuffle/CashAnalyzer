#!/usr/bin/bash
# process the command argument list.
pubDelayHours=18
runDelayHours=6
while [ -n "$1" ]; do
    case $1 in
    "-b")
        fundName="$2"
        #echo "fundName=$fundName"
        shift
        ;;
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "-stdin")
        stdInFile="$2"
        #echo "stdInFile=$stdInFile"
        ;;
    "-nodearg")
        nodeArg="$2"
        #echo "nodeArg=$nodeArg"
        shift
        ;;
    "-pubdelay")
        pubDelayHours="$2"
        #echo "pubDelayHours=$pubDelayHours"
        shift
        ;;
    "-rundelay")
        runDelayHours="$2"
        #echo "runDelayHours=$runDelayHours"
        shift
        ;;
    esac
    shift
done
if [ -z "$fundName" ]; then
    echo "$0: -b fundName missing, need to specify a valid fund ticker."
    exit 1
fi
#if [ ! -d "$HOME/CashAnalyzer/$fundName" ]; then
#    echo "$0: $fundName is not a valid fund name."
#    exit 1
#fi
# look for a -f to force run, overriding the time delays.

source ../meta.$(hostname).sh
# current rate files
jsonRateNew="$fundName-rate-new.json"
jsonRatePub="$publishHome/nasdaq/$fundName/$fundName-rate.json"
csvRatePub="$publishHome/nasdaq/$fundName/$fundName-rate.csv"
jsonRateFlare="$cloudFlareHome/nasdaq/$fundName/$fundName-rate.json"
csvRateFlare="$cloudFlareHome/nasdaq/$fundName/$fundName-rate.csv"
#echo jsonRateNew=$jsonRateNew
#echo jsonRatePub=$jsonRatePub
# history history files
jsonHistoryUnique="$fundName-history-unique.json"
jsonHistoryPub="$publishHome/nasdaq/$fundName/$fundName-history.json"
jsonHistoryFlare="$cloudFlareHome/nasdaq/$fundName/$fundName-history.json"
#echo jsonHistoryUnique=$jsonHistoryUnique
#echo jsonHistoryPub=$jsonHistoryPub
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but report the aging status too.
#
# update the delayHours values as appropriate for the data source.
pubDelaySeconds=$(($pubDelayHours * 60 * 60))
if [ -s "$jsonRatePub" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonRatePub")))" -lt "$pubDelaySeconds" ]; then
    echo "Published file is not yet $pubDelayHours hours old - $(stat -c '%y' "$jsonRatePub" | cut -d: -f1,2)"
    [ -z "$forceRun" ] && exit 0
fi
runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ -s "$jsonRateNew" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonRateNew")))" -lt "$runDelaySeconds" ]; then
    echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$jsonRateNew" | cut -d: -f1,2)"
    [ -z "$forceRun" ] && exit 0
fi
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
scriptFile="./node-nasdaq-update.js"
if [ ! -s "$scriptFile" ]; then
    echo "Missing $scriptFile file."
    exit 1
fi
if [ -z "$stdInFile" ]; then
    node $scriptFile "$nodeArg" | jq . >"$jsonRateNew"
else
    node $scriptFile "$nodeArg" <"$stdInFile" | jq . >"$jsonRateNew"
fi
if [ ! $? ]; then
    echo "$fundName rate retrieval failed, exiting."
    exit 1
fi
if [ ! -s "$jsonRateNew" ]; then
    echo "Empty $fundName rate file."
    exit 1
fi
apyNew=$(grep sevenDayYield "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$apyNew" ] || [ "$apyNew" = "null" ]; then
    echo "New $fundName rate file has empty APY."
    exit 1
fi
#
# Process the daily history results in rate and merge with history.
#
if [ -f "$jsonHistoryPub" ]; then
    jq -s 'flatten | unique_by([.accountType,.asOfDate]) | sort_by([.accountType,.asOfDate])' "$jsonRateNew" "$jsonHistoryPub" >tmp-flatten.json
    cat tmp-flatten.json | node ../lib/node-bank-gapFiller.js | jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
    #rm tmp-flatten.json
else
    cat "$jsonRateNew" | node ../lib/node-bank-gapFiller.js | jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
fi
#
# process google Drive history files
#
lenHistoryUnique=$(grep -o sevenDayYield "$jsonHistoryUnique" | wc -l)
if [ -s "$jsonHistoryPub" ]; then
    lenHistoryPub=$(grep -o sevenDayYield "$jsonHistoryPub" | wc -l)
else
    lenHistoryPub=0
    echo "$fundName history file has not been published."
    dir=$(dirname "$jsonHistoryPub")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echo "entries new($lenHistoryUnique) :: pub($lenHistoryPub)"
if [ $lenHistoryUnique -gt $lenHistoryPub ]; then
    cat "$jsonHistoryUnique" >"$jsonHistoryPub"
    echo "published updated $fundName history file."
fi
#
# process cloudFlare history files
#
lenHistoryUnique=$(grep -o sevenDayYield "$jsonHistoryUnique" | wc -l)
if [ -s "$jsonHistoryFlare" ]; then
    lenHistoryFlare=$(grep -o sevenDayYield "$jsonHistoryFlare" | wc -l)
else
    lenHistoryFlare=0
    echo "$fundName cloudFlare history file has not been published."
    dir=$(dirname "$jsonHistoryFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echo "entries new($lenHistoryUnique) :: flare($lenHistoryFlare)"
if [ $lenHistoryUnique -gt $lenHistoryFlare ]; then
    cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
    echo "published updated $fundName cloudFlare history file."
fi
#
# process the google Drive rate file.
#
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
    echo "New $fundName rate file does not include dates."
    exit 1
fi
#echodateNew=$dateNew
if [ -s "$jsonRatePub" ]; then
    datePub=$(grep asOfDate "$jsonRatePub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
    datePub=""
    echo "$fundName rate file has not been published."
    dir=$(dirname "$jsonRatePub")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echodatePub=$datePub
if [[ $datePub < $dateNew ]]; then
    cat "$jsonRateNew" >"$jsonRatePub"
    echo "published updated $fundName .json rate file."
     (echo 'asOfDate,accountType,apy'; jq -r '.[] | [.asOfDate, .accountType, .apy] | @csv' "$jsonRateNew") > "$csvRatePub"
    echo "published updated $fundName .csv rate file."
fi
#
# process the cloudFlare rate file.
#
if [ -s "$jsonRateFlare" ]; then
    dateFlare=$(grep asOfDate "$jsonRateFlare" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
    dateFlare=""
    echo "$fundName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echodateFlare=$dateFlare
if [[ $dateFlare < $dateNew ]]; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    echo "published updated $fundName cloudFlare .json rate file."
     (echo 'asOfDate,accountType,apy'; jq -r '.[] | [.asOfDate, .accountType, .apy] | @csv' "$jsonRateNew") > "$csvRateFlare"
    echo "published updated $fundName cloudFlare .csv rate file."
fi
exit 0
