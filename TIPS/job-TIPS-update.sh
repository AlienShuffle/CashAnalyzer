#!/usr/bin/bash
#
# This tool now  updates the TIPS data on the cloudflare site and Google Drive.
# Google Drive target removed.
#
# process the command argument list.
pubDelayHours=18
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
jsonRateFlare="$cloudFlareHome/Treasuries/$bankName/$bankName-rate.json"
csvRateFlare="$cloudFlareHome/Treasuries/$bankName/$bankName-rate.csv"
#echo jsonRateNew=$jsonRateNew
# history history files
jsonHistoryUnique="$bankName-history-unique.json"
jsonHistoryFlare="$cloudFlareHome/Treasuries/$bankName/$bankName-history.json"
#echo jsonHistoryUnique=$jsonHistoryUnique
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but report the aging status too.
#
# update the delayHours values as appropriate for the data source.
pubDelaySeconds=$(($pubDelayHours * 60 * 60))
if [ -s "$jsonRateFlare" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonRateFlare")))" -lt "$pubDelaySeconds" ]; then
    echo "Published file is not yet $pubDelayHours hours old - $(stat -c '%y' "$jsonRateFlare" | cut -d: -f1,2)"
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
if [ -f "$jsonHistoryFlare" ]; then
    jq -s 'flatten | unique_by([.maturity,.asOfDate]) | sort_by([.maturity,.asOfDate])' "$jsonRateNew" "$jsonHistoryFlare" >tmp-flatten.json
    cat tmp-flatten.json | jq 'sort_by([.maturity,.asOfDate])' >"$jsonHistoryUnique"
    rm tmp-flatten.json
else
    cat "$jsonRateNew" | jq 'sort_by([.maturity,.asOfDate])' >"$jsonHistoryUnique"
fi
lenHistoryUnique=$(grep -o asOfDate "$jsonHistoryUnique" | wc -l)
#
# cloudFlare publish history file
#
if [ -s "$jsonHistoryFlare" ]; then
    lenHistoryFlare=$(grep -o asOfDate "$jsonHistoryFlare" | wc -l)
else
    lenHistoryFlare=0
    echo "$bankName cloudFlare history file has not been published."
    dir=$(dirname "$jsonHistoryFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echo "entries new($lenHistoryUnique) :: flare($lenHistoryFlare)"
if [ $lenHistoryUnique -gt $lenHistoryFlare ]; then
    cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
    echo "published updated $bankName cloudFlare history file."
fi
#
# process the rate file.
#
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
    echo "New $bankName rate file does not include dates."
    exit 1
fi
#echo dateNew=$dateNew
#
# publish cloudFlare Rate files
#
if [ -s "$jsonRateFlare" ]; then
    dateFlare=$(grep asOfDate "$jsonRateFlare" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
    dateFlare=""
    echo "$bankName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echo dateFlare=$dateFlare
if [[ $dateFlare < $dateNew ]]; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    # save the data file as a .csv as well.
    (
        echo 'asOfDate,maturity,coupon,bid,asked,chg,yield,accruedprincipal'
        jq -r '.[] | [.asOfDate, .maturity, .coupon, .bid, .asked, .chg, .yield, .accruedprincipal] | @csv' "$jsonRateNew"
    ) >"$csvRateFlare"
    echo "published updated $bankName cloudFlare rate file."
fi
exit 0