#!/usr/bin/bash
#
# This a generic version of the daily yields reports to update with a new and
# better model for handling history. Old version took all tickers/accounts and put in one history file.
# This one is intended to put each ticker in its own history file to reduce size and processing overhead on
# on the read side. more effort on the update side (most likely)
#
# process the command argument list.
pubDelayHours=12
runDelayHours=6
while [ -n "$1" ]; do
    case $1 in
    "-b")
        sourceName="$2"
        #echo "sourceName=$sourceName"
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
if [ -z "$sourceName" ]; then
    echo "$0: -b sourceName missing, need to specify a valid Money Market source engine."
    exit 1
fi
# look for a -f to force run, overriding the time delays.

source ../meta.$(hostname).sh
# current rate files
injectRatesJson="inject-rates.json"
jsonRateNew="$sourceName-rate-new.json"
jsonRateFlare="$cloudFlareHome/MM/$sourceName/$sourceName-rate.json"
csvRateFlare="$cloudFlareHome/MM/$sourceName/$sourceName-rate.csv"
#echo jsonRateNew=$jsonRateNew
#echo jsonRateFlare=$jsonRateFlare

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
    # run the scipts to prepare the data.
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
        echo "$sourcename rate retrieval failed, exiting."
        exit 1
    fi
    if [ ! -s "$jsonRateNew" ]; then
        echo "Empty $sourcename rate file."
        exit 1
    fi
    yieldNew=$(grep sevenDayYield "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
    if [ -z "$yieldNew" ] || [ "$yieldNew" = "null" ]; then
        echo "New $sourcename rate file has empty yields."
        exit 1
    fi
fi
#
# Process the daily history results in rate and merge with history.
#
# get list of rates that were updated.
# Then loop through this list of names, extract them from the rate sheet and merge it into the history sheet.
#
grep ticker "$jsonRateNew" | sed 's/^.*ticker": "//' | sed 's/",$//' | sort -u |
    while IFS= read -r ticker; do
        dirname="$(echo "$ticker" | sed -e 's/ /-/g')"
        echo "Processing $ticker"
        [ -d "history/$dirname" ] || mkdir -p "history/$dirname"
        jsonRateTicker="history/$dirname/rate-new.json"
        jsonHistoryUnique="history/$dirname/history-unique.json"
        jsonHistoryFlare="$cloudFlareHome/MM/$dirname/rate-history.json"
        #echo jsonHistoryUnique=$jsonHistoryUnique
        #echo jsonHistoryFlare=$jsonHistoryFlare

        # now for the line I am processing, I need to pull ONLY those items that are appropriate for this line from jsonRateNew and process from here.
        echo filtering by ticker.
        cat "$jsonRateNew" | jq "[.[] | select(.ticker==\"$ticker\")]" >"$jsonRateTicker"

        # sort/filter/gap fill the combined history and current date's rates
        if [ -f "$jsonHistoryFlare" ]; then
            cat "$jsonRateTicker" "$jsonHistoryFlare"
        else
            cat "$jsonRateTicker"
        fi | node ../lib/node-MM-sortBest.js | jq . >"$jsonHistoryUnique"

        #
        # process cloudFlare history files
        #
        echo processing cloudflare files.
        lenHistoryUnique=$(grep -o sevenDayYield "$jsonHistoryUnique" | wc -l)
        if [ -s "$jsonHistoryFlare" ]; then
            lenHistoryFlare=$(grep -o sevenDayYield "$jsonHistoryFlare" | wc -l)
        else
            lenHistoryFlare=0
            echo "$sourceName $ticker cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        fi
        echo "entries new($lenHistoryUnique) :: flare($lenHistoryFlare)"
        if [ $lenHistoryUnique -gt $lenHistoryFlare ]; then
            cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
            echo "published updated $sourceName $ticker cloudFlare history file."
        fi
    done
#
# process the cloudFlare rate file.
#
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
    echo "New $sourceName rate file does not include dates."
    exit 1
fi
if [ -s "$jsonRateFlare" ]; then
    dateFlare=$(grep asOfDate "$jsonRateFlare" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
    dateFlare=""
    echo "$sourceName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echodateFlare=$dateFlare
if [[ $dateFlare < $dateNew ]]; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    echo "published updated $sourceName cloudFlare .json rate file."
    (
        echo 'asOfDate,ticker,sevenDayYield'
        jq -r '.[] | [.asOfDate, .ticker, .sevenDayYield] | @csv' "$jsonRateNew"
    ) >"$csvRateFlare"
    echo "published updated $sourceName cloudFlare .csv rate file."
fi
exit 0
