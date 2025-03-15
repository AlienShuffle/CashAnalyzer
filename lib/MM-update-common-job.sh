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
jsonRateFlare="$cloudFlareHome/MM/$sourceName/$sourceName-rates.json"
csvRateFlare="$cloudFlareHome/MM/$sourceName/$sourceName-rates.csv"
jsonRateAllFlare="$cloudFlareHome/MM/all-rates.json"
csvRateAllFlare="$cloudFlareHome/MM/all-rates.csv"
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
        # rates only for this query from this tool.
        jsonRateTicker="history/$dirname/rate-new.json"
        # temp merge of this query with this tool's history.
        jsonHistoryTemp="history/$dirname/history-$sourceName-temp.json"
        # resulting merged history of this tool's rates.
        jsonHistoryUnique="history/$dirname/history-$sourceName-unique.json"
        # temp merge of this tool's history with the combined history published in cloudflare (for comparison with cloudflare)
        jsonHistoryFlareTemp="history/$dirname/history-$sourceName-flare.json"
        # resulting published merge of this tool and all combined source histories.
        jsonHistoryFlare="$cloudFlareHome/MM/$dirname/rate-history.json"
        csvHistoryFlare="$cloudFlareHome/MM/$dirname/rate-history.csv"

        # I need to pull ONLY those items that are appropriate for this line from jsonRateNew and process from here.
        cat "$jsonRateNew" | jq "[.[] | select(.ticker==\"$ticker\")]" >"$jsonRateTicker"

        # sort/filter/gap fill the combined history and current date's rates using only this tool's data.
        if [ -f "$jsonHistoryUnique" ]; then
            jq -s 'flatten | unique_by([.ticker,.asOfDate,.source]) | sort_by([.ticker,.asOfDate,.source])' "$jsonRateTicker" "$jsonHistoryUnique" >"$jsonHistoryTemp"
        else
            cat "$jsonRateTicker" >"$jsonHistoryTemp"
        fi
        cat "$jsonHistoryTemp" | node ../lib/node-MM-sortBest.js | jq . >"$jsonHistoryUnique"
        rm "$jsonHistoryTemp"

        # sort/filter/gapfill this combined history with data from all sources in cloudflare repository.
        if [ -s "$jsonHistoryFlare" ]; then
            jq -s 'flatten | unique_by([.ticker,.asOfDate,.source]) | sort_by([.ticker,.asOfDate,.source])' "$jsonHistoryUnique" "$jsonHistoryFlare" |
                node ../lib/node-MM-sortBest.js |
                jq . >"$jsonHistoryFlareTemp"
        else
            cat "$jsonHistoryUnique" |
                node ../lib/node-MM-sortBest.js |
                jq . >"$jsonHistoryFlareTemp"
            echo "$sourceName $ticker cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        fi
        #
        # process cloudFlare history files for this data source.
        #
        if ../lib/jsonDifferent.sh "$jsonHistoryFlareTemp" "$jsonHistoryFlare"; then
            cat "$jsonHistoryFlareTemp" >"$jsonHistoryFlare"
            echo "published updated $sourceName $ticker cloudFlare history file."
            (
                echo 'asOfDate,ticker,oneDayYield,sevenDayYield,thirtyDayYield,source'
                jq -r '.[] | [.asOfDate, .ticker, .oneDayYield, .sevenDayYield, .thirtyDayYield,.source] | @csv' "$jsonHistoryFlare"
            ) >"$csvHistoryFlare"
            echo "published updated cloudflare $csvHistoryFlare file."
        fi
    done
#
# process the cloudFlare rate file for this tool.
#
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
    echo "New $sourceName rate file does not include dates."
    exit 1
fi
if [ ! -s "$jsonRateFlare" ]; then
    echo "$sourceName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
if ../lib/jsonDifferent.sh "$jsonRateNew" "$jsonRateFlare"; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    echo "published updated cloudflare $sourceName-rates.json file."
    (
        echo 'asOfDate,ticker,oneDayYield,sevenDayYield,thirtyDayYield'
        jq -r '.[] | [.asOfDate, .ticker, .oneDayYield, .sevenDayYield, .thirtyDayYield] | @csv' "$jsonRateNew"
    ) >"$csvRateFlare"
    echo "published updated cloudflare $sourceName-rates.csv file."
fi
#
# Merge current tool's current rates into the All tools rate file (keeping only best, most recent reported values)
#
if [ -s "$jsonRateAllFlare" ]; then
    jq -s 'flatten | unique_by([.ticker,.asOfDate,.source]) | sort_by([.ticker,.asOfDate,.source])' "$jsonRateNew" "$jsonRateAllFlare" |
        node ../lib/node-MM-sortBest.js latest |
        jq . >tmp-all-flare.json
else
    echo "$jsonRateAllFlare cloudFlare file has not been published."
    dir=$(dirname "$jsonRateAllFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
    cat "$jsonRateNew" |
        node ../lib/node-MM-sortBest.js latest |
        jq . >tmp-all-flare.json
fi
# if the new merged file is different, then publish it.
if ../lib/jsonDifferent.sh tmp-all-flare.json "$jsonRateAllFlare"; then
    cat tmp-all-flare.json >"$jsonRateAllFlare"
    echo "published updated cloudflare $jsonRateAllFlare file."
    (
        echo 'asOfDate,ticker,oneDayYield,sevenDayYield,thirtyDayYield,source'
        jq -r '.[] | [.asOfDate, .ticker, .oneDayYield, .sevenDayYield, .thirtyDayYield,.source] | @csv' "$jsonRateAllFlare"
    ) >"$csvRateAllFlare"
    echo "published updated cloudflare $csvRateAllFlare file."
fi
rm -f tmp-all-flare.json
