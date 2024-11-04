#!/usr/bin/bash
# process the command argument list.
pubDelayHours=20
runDelayHours=2
bankName='TIPS'
while [ -n "$1" ]; do
    case $1 in
    "-b")
        bankName="$2"
        #echo "bankname=$bankName"
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
if [ -z "$bankName" ]; then
    echo "$0: -b bankName missing, need to specify a valid bank."
    exit 1
fi
if [ ! -d "$HOME/CashAnalyzer/$bankName" ]; then
    echo "$0: $bankName is not a valid bank name."
    exit 1
fi
# look for a -f to force run, overriding the time delays.

source ../meta.$(hostname).sh
# current rate files
jsonRateNew="$bankName-rate-new.json"
jsonRatePub="$publishHome/Treasuries/$bankName/$bankName-rate.json"
csvRatePub="$publishHome/Treasuries/$bankName/$bankName-rate.csv"
#echo jsonRateNew=$jsonRateNew
#echo jsonRatePub=$jsonRatePub
# history history files
jsonHistoryUnique="$bankName-history-unique.json"
jsonHistoryPub="$publishHome/Treasuries/$bankName/$bankName-history.json"
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
scriptFile="./node-$bankName-update.js"
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
    echo "$bankName rate retrieval failed, exiting."
    exit 1
fi
if [ ! -s "$jsonRateNew" ]; then
    echo "Empty $bankName rate file."
    exit 1
fi
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ] || [ "$dateNew" = "null" ]; then
    echo "New $bankName rate file has empty timestamps."
    exit 1
fi
#
# Process the daily history results in rate and merge with history.
#
if [ -f "$jsonHistoryPub" ]; then
    jq -s 'flatten | unique_by([.maturity,.asOfDate]) | sort_by([.maturity,.asOfDate])' "$jsonRateNew" "$jsonHistoryPub" >tmp-flatten.json
    cat tmp-flatten.json | jq 'sort_by([.maturity,.asOfDate])' >"$jsonHistoryUnique"
    #rm tmp-flatten.json
else
    cat "$jsonRateNew" | jq 'sort_by([.maturity,.asOfDate])' >"$jsonHistoryUnique"
fi
lenHistoryUnique=$(grep -o asOfDate "$jsonHistoryUnique" | wc -l)
if [ -s "$jsonHistoryPub" ]; then
    lenHistoryPub=$(grep -o asOfDate "$jsonHistoryPub" | wc -l)
else
    lenHistoryPub=0
    echo "$bankName history file has not been published."
    dir=$(dirname "$jsonHistoryPub")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
echo "entries new($lenHistoryUnique) :: pub($lenHistoryPub)"
if [ $lenHistoryUnique -gt $lenHistoryPub ]; then
    cat "$jsonHistoryUnique" >"$jsonHistoryPub"
    echo "published updated $bankName history file."
fi
#
# process the rate file.
#
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
    echo "New $bankName rate file does not include dates."
    exit 1
fi
echo dateNew=$dateNew

if [ -s "$jsonRatePub" ]; then
    datePub=$(grep asOfDate "$jsonRatePub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
    datePub=""
    echo "$bankName rate file has not been published."
    dir=$(dirname "$jsonRatePub")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
echo datePub=$datePub
if [[ $datePub < $dateNew ]]; then
    cat "$jsonRateNew" >"$jsonRatePub"
    # save the data file as a .csv as well.
    (echo 'asOfDate,maturity,coupon,bid,chg,yield,accruedprincipal'; jq -r '.[] | [.asOfDate, .maturity, .coupon, .bid, .chg, .yield, .accruedprincipal] | @csv' "$jsonRateNew") > "$csvRatePub"
    echo "published updated $bankName rate file."
fi
exit 0