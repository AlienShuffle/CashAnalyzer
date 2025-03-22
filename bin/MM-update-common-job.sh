#!/usr/bin/bash
#
# This a generic version of the daily yields reports to update with a new and
# better model for handling history.
# This one is intended to put each ticker in its own history file to reduce size and processing overhead on
# on the read side. More effort on the update side due to separate files to process.
#
# process the command argument list.
pubDelayHours=16
runDelayHours=4
accountClass=MM
while [ -n "$1" ]; do
    case $1 in
    "--accountClass")
        accountClass="$2"
        #echo "accountClass=$accountClass"
        shift
        ;;
    "--collectionScript")
        collectionScript="$2"
        #echo "collectionScript=$collectionScript"
        shift
        ;;
    "--collectionArg")
        collectionArg="$2"
        #echo "collectionArg=$collectionArg"
        shift
        ;;
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "--injectProcessedJson")
        injectProcessedJson="$2"
        #echo "injectProcessedJson=$injectProcessedJson"
        shift
        ;;
    "--nodeArg")
        nodeArg="$2"
        #echo "nodeArg=\"$nodeArg\""
        shift
        ;;
    "--pubDelay")
        pubDelayHours="$2"
        #echo "pubDelayHours=$pubDelayHours"
        shift
        ;;
    "--processScript")
        processScript="$2"
        #echo "processScript=$processScript"
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
    *)
        echo "Parameter $1 ignored"
        shift
        ;;
    esac
    shift
done
# computer-specific configurations.
source ../meta.$(hostname).sh
# if a sourceName is not specified, use the current directory name.
if [ -z "$sourceName" ]; then
    sourceName=$(basename $(pwd))
fi
# if a script file is not specified, try a default name.
if [ -z "$processScript" ]; then
    processScript="./node-$sourceName-update.js"
fi
# create data source file paths.
jsonRateNew="$sourceName-rate-new.json"
jsonRateFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-rates.json"
csvRateFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-rates.csv"
jsonRateAllFlare="$cloudFlareHome/$accountClass/all-rates.json"
csvRateAllFlare="$cloudFlareHome/$accountClass/all-rates.csv"
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but still report the aging status.
#
if [ -n "$injectProcessedJson" ] && [ -s "$injectProcessedJson" ]; then
    echo "Using $injectProcessedJson instead of querying online source."
    jsonRateNew="$injectProcessedJson"
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
    if [ ! -s "$processScript" ]; then
        echo "Missing $processScript file."
        exit 1
    fi
    if [ "$collectionScript" ]; then
        if [ ! -x "$collectionScript" ]; then
            echo "invalid collectionScript $collectionScript, exiting..."
            exit 1
        fi
        tmpCollect="tmpCollect.json"
        #echo "running $collectionScript"
        if [ -n "$collectionArg" ]; then
            $collectionScript "$collectionArg" >"$tmpCollect"
        else
            $collectionScript >"$tmpCollect"
        fi
        #echo "running node $processScript"
        cat "$tmpCollect" | node $processScript $nodeArg | jq . >"$jsonRateNew"
        rm -f "$tmpCollect"
    elif [ -s "$stdInFile" ]; then
        node $processScript "$nodeArg" <"$stdInFile" | jq . >"$jsonRateNew"
    else
        node $processScript "$nodeArg" | jq . >"$jsonRateNew"
    fi
    if [ ! $? ]; then
        echo "$sourceName rate retrieval failed, exiting."
        exit 1
    fi
    if [ ! -s "$jsonRateNew" ]; then
        echo "Empty $sourceName rate file."
        exit 1
    fi
    yieldNew=$(grep sevenDayYield "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
    if [ -z "$yieldNew" ] || [ "$yieldNew" = "null" ]; then
        echo "New $sourceName rate file has empty yields."
        exit 1
    fi
fi
# sort/normalize the file now.
jq 'sort_by([.accountType,.asOfDate])' "$jsonRateNew" >tmp.sort.json
cat tmp.sort.json >"$jsonRateNew"
rm -f tmp.sort.json
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
        jsonHistoryFlare="$cloudFlareHome/$accountClass/$dirname/$dirname-rate-history.json"
        csvHistoryFlare="$cloudFlareHome/$accountClass/$dirname/$dirname-rate-history.csv"

        # I need to pull ONLY those items that are appropriate for this line from jsonRateNew and process from here.
        cat "$jsonRateNew" | jq "[.[] | select(.ticker==\"$ticker\")]" >"$jsonRateTicker"

        # sort/filter/gap fill the combined history and current date's rates using only this tool's data.
        if [ -f "$jsonHistoryUnique" ]; then
            jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonRateTicker" "$jsonHistoryUnique" >"$jsonHistoryTemp"
        else
            cat "$jsonRateTicker" >"$jsonHistoryTemp"
        fi
        cat "$jsonHistoryTemp" | node ../lib/node-MM-sortBest.js | jq . >"$jsonHistoryUnique"
        rm "$jsonHistoryTemp"

        # sort/filter/gapfill this combined history with data from all sources in cloudflare repository.
        if [ ! -s "$jsonHistoryFlare" ]; then
            cat "$jsonHistoryUnique" |
                node ../lib/node-MM-sortBest.js |
                jq . >"$jsonHistoryFlareTemp"
            echo "$sourceName $ticker cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        else
            jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonHistoryUnique" "$jsonHistoryFlare" |
                node ../lib/node-MM-sortBest.js |
                jq . >"$jsonHistoryFlareTemp"
        fi
        #
        # process cloudFlare history files for this data source.
        #
        if ../bin/jsonDifferent.sh "$jsonHistoryFlareTemp" "$jsonHistoryFlare"; then
            cat "$jsonHistoryFlareTemp" >"$jsonHistoryFlare"
            echo "published updated $sourceName $ticker cloudFlare history file."
            (
                echo 'asOfDate,ticker,oneDayYield,sevenDayYield,thirtyDayYield,source'
                jq -r '.[] | [.asOfDate, .ticker, .oneDayYield, .sevenDayYield, .thirtyDayYield,.source] | @csv' "$jsonHistoryFlare"
            ) >"$csvHistoryFlare"
            echo "published updated cloudflare csv file."
        fi
    done
#
# process the cloudFlare rate file for this tool.
#
if [ -z "$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')" ]; then
    echo "New $sourceName rate file does not include dates."
    exit 1
fi
if [ ! -s "$jsonRateFlare" ]; then
    echo "$sourceName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
if ../bin/jsonDifferent.sh "$jsonRateNew" "$jsonRateFlare"; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    echo "published updated cloudflare $sourceName-rates.json file."
    (
        echo 'asOfDate,ticker,oneDayYield,sevenDayYield,thirtyDayYield'
        jq -r '.[] | [.asOfDate, .ticker, .oneDayYield, .sevenDayYield, .thirtyDayYield] | @csv' "$jsonRateFlare"
    ) >"$csvRateFlare"
    echo "published updated cloudflare $sourceName-rates.csv file."
fi
#
# Merge current tool's current rates into the All tools rate file (keeping only best, most recent reported values)
#
if [ -s "$jsonRateAllFlare" ]; then
    jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonRateNew" "$jsonRateAllFlare" |
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
if ../bin/jsonDifferent.sh tmp-all-flare.json "$jsonRateAllFlare"; then
    cat tmp-all-flare.json >"$jsonRateAllFlare"
    echo "published updated cloudflare $jsonRateAllFlare file."
    (
        echo 'asOfDate,ticker,oneDayYield,sevenDayYield,thirtyDayYield,source'
        jq -r '.[] | [.asOfDate,.ticker,.oneDayYield,.sevenDayYield,.thirtyDayYield,.source] | @csv' "$jsonRateAllFlare"
    ) >"$csvRateAllFlare"
    echo "published updated cloudflare $csvRateAllFlare file."
fi
rm -f tmp-all-flare.json
