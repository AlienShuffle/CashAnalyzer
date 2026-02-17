#!/usr/bin/bash
#
# This a generic version of the ETF updates (distributions, facts, yields)
# This one is intended to put each ticker in its own history file to reduce size and processing overhead on
# on the read side. More effort on the update side due to separate files to process.
#
# process the command argument list.
pubDelayHours=16
runDelayHours=4
accountClass=Funds
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
    "--nightDelayHour")
        nightDelayHour="$2"
        #echo "nightDelayHour=$nightDelayHour"
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
    "-q" | "--quiet")
        quiet="true"
        #echo "quiet=true"
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
    processScript="./node-$sourceName-facts-update.js"
fi
# create data source file paths.
[ -d history ] || mkdir history
jsonFactsNew="history/$sourceName-facts-new.json"
jsonFactsFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-factset.json"
csvFactsFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-factset.csv"
jsonFactsAllFlare="$cloudFlareHome/$accountClass/all-facts.json"
csvFactsAllFlare="$cloudFlareHome/$accountClass/all-facts.csv"
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but still report the aging status.
#
if [ -n "$injectProcessedJson" ] && [ -s "$injectProcessedJson" ]; then
    echo "Using $injectProcessedJson instead of querying online source."
    jsonFactsNew="$injectProcessedJson"
else
    source ../bin/skipWeekends.sh
    pubDelayFile="$jsonFactsFlare"
    runDelayFile="$jsonFactsNew"
    source ../bin/testDelays.sh
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
        cat "$tmpCollect" | node $processScript "$nodeArg" | jq . >"$jsonFactsNew"
        rm -f "$tmpCollect"
    else
        #echo "node $processScript $nodeArg | jq . >$jsonFactsNew"; exit 1
        node $processScript "$nodeArg" | jq . >"$jsonFactsNew"
    fi
    if [ ! $? ]; then
        echo "$sourceName Facts retrieval failed, exiting."
        exit 1
    fi
    if [ ! -s "$jsonFactsNew" ]; then
        echo "Empty $sourceName Facts file."
        exit 1
    fi
    yieldNew=$(grep DayYield "$jsonFactsNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
    if [ -z "$yieldNew" ] || [ "$yieldNew" = "null" ]; then
        echo "New $sourceName Facts file has empty yields."
        exit 1
    fi
fi
# sort/normalize the file now.
jq 'sort_by(.asOfDate)' "$jsonFactsNew" >tmp.sort.json
cat tmp.sort.json >"$jsonFactsNew"
#cat $jsonFactsNew
rm -f tmp.sort.json
#
# Process the daily history results in Facts and merge with history.
#
# get list of Factss that were updated.
# Then loop through this list of names, extract them from the Facts sheet and merge it into the history sheet.
#
grep ticker "$jsonFactsNew" | sed 's/^.*ticker": "//' | sed -e 's/",$//' | sed -e 's/"$//' | sort -u |
    while IFS= read -r ticker; do
        dirname="$(echo "$ticker" | sed -e 's/ /-/g')"
        [ "$quiet" = "true" ] || echo "Processing $ticker"
        [ -d "history/$dirname" ] || mkdir -p "history/$dirname"
        # Factss only for this query from this tool.
        jsonFactsTicker="history/$dirname/facts-new.json"
        # temp merge of this query with this tool's history.
        jsonHistoryTemp="history/$dirname/history-$sourceName-temp.json"
        # resulting merged history of this tool's Factss.
        jsonHistoryUnique="history/$dirname/history-$sourceName-unique.json"
        # temp merge of this tool's history with the combined history published in cloudflare (for comparison with cloudflare)
        jsonHistoryFlareTemp="history/$dirname/history-$sourceName-flare.json"
        # resulting published merge of this tool and all combined source histories.
        jsonHistoryFlare="$cloudFlareHome/$accountClass/$dirname/$dirname-facts-history.json"
        csvHistoryFlare="$cloudFlareHome/$accountClass/$dirname/$dirname-facts-history.csv"

        # I need to pull ONLY those items that are appropriate for this line from jsonFactsNew and process from here.
        cat "$jsonFactsNew" | jq "[.[] | select(.ticker==\"$ticker\")]" >"$jsonFactsTicker"

        # sort/filter/gap fill the combined history and current date's Factss using only this tool's data.
        if [ -f "$jsonHistoryUnique" ]; then
            jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonFactsTicker" "$jsonHistoryUnique" >"$jsonHistoryTemp"
        else
            cat "$jsonFactsTicker" >"$jsonHistoryTemp"
        fi
        cat "$jsonHistoryTemp" | node ../lib/node-sortBest.js | jq . >"$jsonHistoryUnique"
        #rm "$jsonHistoryTemp"

        # sort/filter/gapfill this combined history with data from all sources in cloudflare repository.
        if [ ! -s "$jsonHistoryFlare" ]; then
            cat "$jsonHistoryUnique" |
                node ../lib/node-sortBest.js |
                jq . >"$jsonHistoryFlareTemp"
            echo "$sourceName $ticker cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        else
            jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonHistoryUnique" "$jsonHistoryFlare" |
                node ../lib/node-sortBest.js |
                jq . >"$jsonHistoryFlareTemp"
        fi
        #
        # process cloudFlare history files for this data source.
        #
        if ../bin/jsonDifferent.sh "$jsonHistoryFlareTemp" "$jsonHistoryFlare"; then
            cat "$jsonHistoryFlareTemp" >"$jsonHistoryFlare"
            echo "published updated $sourceName $ticker cloudFlare history file."
            (
                echo 'asOfDate,ticker,thirtyDayYield,duration,maturity,er'
                jq -r '.[] | [.asOfDate, .ticker, .nav, .thirtyDayYield,.duration, .maturity, .er] | @csv' "$jsonHistoryFlare"
            ) >"$csvHistoryFlare"
            echo "published updated cloudflare csv file."
        fi
    done
#
# process the cloudFlare Facts file for this tool.
#
if [ -z "$(grep asOfDate "$jsonFactsNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')" ]; then
    echo "New $sourceName Facts file does not include dates."
    exit 1
fi
if [ ! -s "$jsonFactsFlare" ]; then
    echo "$sourceName cloudFlare Facts file has not been published."
    dir=$(dirname "$jsonFactsFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
if ../bin/jsonDifferent.sh "$jsonFactsNew" "$jsonFactsFlare"; then
    cat "$jsonFactsNew" >"$jsonFactsFlare"
    echo "published updated cloudflare $sourceName-facts.json file."
    (
        echo 'asOfDate,ticker,thirtyDayYield,duration,maturity,er'
        jq -r '.[] | [.asOfDate, .ticker, .nav, .thirtyDayYield,.duration, .maturity, .er] | @csv' "$jsonFactsFlare"
    ) >"$csvFactsFlare"
    echo "published updated cloudflare $sourceName-facts.csv file."
fi
#
# Merge current tool's current Factss into the All tools Facts file (keeping only best, most recent reported values)
#
if [ -s "$jsonFactsAllFlare" ]; then
    jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonFactsNew" "$jsonFactsAllFlare" |
        node ../lib/node-sortBest.js latest |
        jq . >tmp-all-flare.json
else
    echo "$jsonFactsAllFlare cloudFlare file has not been published."
    dir=$(dirname "$jsonFactsAllFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
    cat "$jsonFactsNew" |
        node ../lib/node-sortBest.js latest |
        jq . >tmp-all-flare.json
fi
# if the new merged file is different, then publish it.
if ../bin/jsonDifferent.sh tmp-all-flare.json "$jsonFactsAllFlare"; then
    cat tmp-all-flare.json >"$jsonFactsAllFlare"
    echo "published updated cloudflare $jsonFactsAllFlare file."
    (
        echo 'asOfDate,ticker,accountType,thirtyDayYield,nav,aum,twelveMonTrlYield,yieldToMaturity,distributionYield,weightedAverageCoupon,durationYears,maturityYears,expenseRatio'
        jq -r '.[] | [.asOfDate,.ticker,.accountType,.thirtyDayYield,.nav,.aum,.twelveMonTrlYield,.yieldToMaturity,.distributionYield,.weightedAverageCoupon,.durationYears,.maturityYears,.expenseRatio] | @csv' "$jsonFactsAllFlare"
    ) >"$csvFactsAllFlare"
    echo "published updated cloudflare $csvFactsAllFlare file."
fi
rm -f tmp-all-flare.json
