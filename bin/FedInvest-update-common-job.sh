#!/usr/bin/bash
#
# This tool now  updates the TIPS data on the cloudflare site and Google Drive.
# I will be turning off the Google Drive target eventually.
#
# process the command argument list.
pubDelayHours=20
runDelayHours=2
sourceName=$(basename $(pwd))
while [ -n "$1" ]; do
    case $1 in
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "-nodeArg")
        nodeArg="$2"
        #echo "nodeArg=$nodeArg"
        shift
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
    "--sourceName")
        sourceName="$2"
        #echo "sourceName=$sourceName"
        shift
        ;;
    esac
    shift
done
if [ ! -d "$HOME/CashAnalyzer/$sourceName" ]; then
    echo "$0: $sourceName is not a valid bank name."
    exit 1
fi
source ../meta.$(hostname).sh
# current rate files
injectRatesJson="inject-rates.json"
jsonRateNew="$sourceName-rate-new.json"
jsonRateFlare="$cloudFlareHome/Treasuries/$sourceName/$sourceName-rate.json"
csvRateFlare="$cloudFlareHome/Treasuries/$sourceName/$sourceName-rate.csv"
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but report the aging status too.
#
# update the delayHours values as appropriate for the data source.
if [ -s "$injectRatesJson" ]; then
    echo "Using $injectRatesJson instead"
    jsonRateNew="$injectRatesJson"
else
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
    scriptFile="./node-$sourceName-update.js"
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
        echo "$sourceName rate retrieval failed, exiting."
        exit 1
    fi
    if [ ! -s "$jsonRateNew" ]; then
        echo "Empty $sourceName rate file."
        exit 1
    fi
    dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
    if [ -z "$dateNew" ] || [ "$dateNew" = "null" ]; then
        echo "New $sourceName rate file has empty timestamps."
        exit 1
    fi
fi
#
# Process the daily history results in rate and merge with history.
#
##################################
grep cusip "$jsonRateNew" | sed 's/^.*cusip": "//' | sed 's/",$//' | sort -u |
    while IFS= read -r cusip; do
        dirname="history/$cusip"
        #echo "Processing $cusip"
        [ -d "$dirname" ] || mkdir -p "$dirname"
        jasonRateCusip="$dirname/rate-new.json"
        jsonHistoryUnique="$dirname/history-unique.json"
        jsonHistoryFlare="$cloudFlareHome/Treasuries/$sourceName/$dirname/rate-history.json"
        csvHistoryFlare="$cloudFlareHome/Treasuries/$sourceName/$dirname/rate-history.csv"

        # now for the line I am processing, I need to pull ONLY those items that are appropriate for this line from jsonRateNew and process from here.
        cat "$jsonRateNew" | jq "[.[] | select(.cusip==\"$cusip\")]" >"$jasonRateCusip"

        if [ -f "$jsonHistoryFlare" ]; then
            jq -s 'flatten | unique_by([.cusip,.asOfDate]) | sort_by([.cusip,.asOfDate])' "$jasonRateCusip" "$jsonHistoryFlare" >tmp-flatten.json
            cat tmp-flatten.json | jq 'sort_by([.cusip,.asOfDate])' >"$jsonHistoryUnique"
            rm tmp-flatten.json
        else
            cat "$jasonRateCusip" | jq 'sort_by([.cusip,.asOfDate])' >"$jsonHistoryUnique"
        fi
        lenHistoryUnique=$(grep -o asOfDate "$jsonHistoryUnique" | wc -l)
        #
        # cloudFlare publish history file
        #
        if [ -s "$jsonHistoryFlare" ]; then
            lenHistoryFlare=$(grep -o asOfDate "$jsonHistoryFlare" | wc -l)
        else
            lenHistoryFlare=0
            echo "$sourceName cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        fi
        #echo "entries new($lenHistoryUnique) :: flare($lenHistoryFlare)"
        if [ $lenHistoryUnique -gt $lenHistoryFlare ]; then
            cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
            (
                echo 'asOfDate, cusip, securitytype, rate, maturitydate, calldate, buy, sell, endofday, key'
                jq -r '.[] | [.asOfDate, .cusip, .securitytype, .rate, .maturitydate, .calldate, .buy, .sell, .endofday, .key] | @csv' "$jsonHistoryUnique"
            ) >"$csvHistoryFlare"
            echo "published updated $sourceName cloudFlare history file."
        fi
    done
###################################################
#
# process the rate file.
#
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
    echo "New $sourceName rate file does not include dates."
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
    echo "$sourceName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echo dateFlare=$dateFlare
if [[ $dateFlare < $dateNew ]]; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    # save the data file as a .csv as well.
    (
        echo 'asOfDate, cusip, securitytype, rate, maturitydate, calldate, buy, sell, endofday, key'
        jq -r '.[] | [.asOfDate, .cusip, .securitytype, .rate, .maturitydate, .calldate, .buy, .sell, .endofday, .key] | @csv' "$jsonRateNew"
    ) >"$csvRateFlare"
    echo "published updated $sourceName cloudFlare rate file."
fi
exit 0
