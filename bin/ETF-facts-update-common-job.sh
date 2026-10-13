#!/usr/bin/bash
#
# This a generic version of the ETF updates (distributions, facts, yields)
# This one is intended to put each ticker in its own history file to reduce size and processing overhead on
# on the read side. More effort on the update side due to separate files to process.
# --inputFile supplies processScript input when no collectionScript is used.
#
# process the command argument list.
pubDelayHours=8
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
    "-d" | "--debug")
        debug="true"
        #echo "debug=true"
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
    "--inputFile")
        inputFile="$2"
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
    "--runWeekends")
        runWeekends="true"
        #echo "runWeekends=$runWeekends"
        ;;
    "--sourceName")
        sourceName="$2"
        #echo "sourceName=$sourceName"
        shift
        ;;
    *)
        echo "$(basename $0): Parameter $1 ignored"
        shift
        ;;
    esac
    shift
done
# computer-specific configurations.
source ../meta.common.sh
source ../bin/nodeJobUtils.sh
# usage: sortBest <inFile> <outFile> [latest]  - true if outFile is a valid non-empty array.
sortBest() {
    node ../lib/node-sortBest.js ${3:+"$3"} --input "$1" --output "$2" && isJsonArray "$2"
}
# usage: publishFacts <srcFile> <jsonDest> <csvDest>  - atomically publish json and csv, refusing empty or invalid json.
publishFacts() {
    if ! isJsonArray "$1"; then
        echo "REFUSED to publish $2 from invalid or empty $1."
        return 1
    fi
    publishFile "$1" "$2" || return 1
    {
        echo "$csvHeader"
        jq -r "$csvElements" "$2"
    } >"$3.tmp.$$" && mv -f "$3.tmp.$$" "$3" || {
        echo "failed to write $3"
        rm -f "$3.tmp.$$"
        return 1
    }
}

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
jsonFactsFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-facts.json"
csvFactsFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-facts.csv"
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

        if [ -n "$collectionArg" ]; then
            #echo "running: $collectionScript $collectionArg > $tmpCollect"
            $collectionScript "$collectionArg" >"$tmpCollect"
        else
            #echo "running: $collectionScript > $tmpCollect"
            $collectionScript >"$tmpCollect"
        fi
        statuses=("${PIPESTATUS[@]}")
        if [ "${statuses[0]}" -ne 0 ]; then
            echo "$sourceName collectionScript failed, exiting."
            exit 1
        fi
        if [ ! -s "$tmpCollect" ]; then
            echo "Empty collection File $tmpCollect."
            exit 1
        fi
        runNode "$jsonFactsNew" "$tmpCollect" $processScript "$nodeArg"
        [ "$debug" = "true" ] || rm -f "$tmpCollect"
        if ! pipeOk "${statuses[@]}"; then
            echo "$sourceName Facts retrieval failed (status ${statuses[*]}), raw output kept in $jsonFactsNew.raw, exiting."
            exit 1
        fi
    else
        if ! runNode "$jsonFactsNew" "${inputFile:--}" $processScript "$nodeArg"; then
            echo "$sourceName Facts processScript failed (status ${statuses[*]}), raw output kept in $jsonFactsNew.raw, exiting."
            exit 1
        fi
    fi
    if ! isJsonArray "$jsonFactsNew"; then
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
if ! jq 'sort_by(.asOfDate)' "$jsonFactsNew" >tmp.sort.json || ! isJsonArray tmp.sort.json; then
    echo "$sourceName failed to sort $jsonFactsNew, exiting."
    exit 1
fi
cat tmp.sort.json >"$jsonFactsNew"
[ "$debug" = "true" ] || rm -f tmp.sort.json
#
# Process the daily history results in Facts and merge with history.
#
# get list of Factss that were updated.
# Then loop through this list of names, extract them from the Facts sheet and merge it into the history sheet.
#
csvHeader='asOfDate,ticker,oneDayYield,sevenDayYield,thirtyDayYield,nav,aum,twelveMonTrlYield,yieldToWorst,yieldToMaturity,distributionYield,weightedAverageCoupon,durationYears,maturityYears,expenseRatio,accountType,source'
csvElements='.[] | [.asOfDate,.ticker,.oneDayYield,.sevenDayYield,.thirtyDayYield,.nav,.aum,.twelveMonTrlYield,.yieldToWorst,.yieldToMaturity,.distributionYield,.weightedAverageCoupon,.durationYears,.maturityYears,.expenseRatio,.accountType,.source] | @csv'

grep ticker "$jsonFactsNew" | sed 's/^.*ticker": "//' | sed -e 's/",$//' | sed -e 's/"$//' | sort -u |
    while IFS= read -r ticker; do
        dirname=$(echo "$ticker" | sed -e 's/ /-/g')
        [ "$quiet" = "true" ] || echo "Processing facts: $ticker"
        [ -d "history/$dirname" ] || mkdir -p "history/$dirname"
        # Factss only for this query from this tool.
        jsonFactsTicker="history/$dirname/facts-new.json"
        # temp merge of this query with this tool's history.
        jsonHistoryTemp="history/$dirname/facts-history-$sourceName-temp.json"
        # resulting merged history of this tool's Factss.
        jsonHistoryUnique="history/$dirname/facts-history-$sourceName-unique.json"
        # temp merge of this tool's history with the combined history published in cloudflare (for comparison with cloudflare)
        jsonHistoryFlareTemp="history/$dirname/facts-history-$sourceName-flare.json"
        # resulting published merge of this tool and all combined source histories.
        jsonHistoryFlare="$cloudFlareHome/$accountClass/$dirname/$dirname-facts-history.json"
        csvHistoryFlare="$cloudFlareHome/$accountClass/$dirname/$dirname-facts-history.csv"

        # I need to pull ONLY those items that are appropriate for this line from jsonFactsNew and process from here.
        if ! jq "[.[] | select(.ticker==\"$ticker\")]" "$jsonFactsNew" >"$jsonFactsTicker" || ! isJsonArray "$jsonFactsTicker"; then
            echo "$sourceName $ticker failed to extract facts, skipping."
            continue
        fi

        # sort/filter/gap fill the combined history and current date's Factss using only this tool's data.
        if [ -f "$jsonHistoryUnique" ]; then
            jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonFactsTicker" "$jsonHistoryUnique" >"$jsonHistoryTemp"
        else
            cat "$jsonFactsTicker" >"$jsonHistoryTemp"
        fi
        if [ $? -ne 0 ] || ! sortBest "$jsonHistoryTemp" "$jsonHistoryUnique.new"; then
            echo "$sourceName $ticker failed to merge facts history, skipping."
            rm -f "$jsonHistoryUnique.new"
            continue
        fi
        mv -f "$jsonHistoryUnique.new" "$jsonHistoryUnique"
        [ "$debug" = "true" ] || rm -f "$jsonHistoryTemp"

        # sort/filter/gapfill this combined history with data from all sources in cloudflare repository.
        rm -f "$jsonHistoryFlareTemp"
        if [ ! -s "$jsonHistoryFlare" ]; then
            sortBest "$jsonHistoryUnique" "$jsonHistoryFlareTemp"
            echo "$sourceName $ticker cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        else
            jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonHistoryUnique" "$jsonHistoryFlare" >"$jsonHistoryFlareTemp.combined" &&
                sortBest "$jsonHistoryFlareTemp.combined" "$jsonHistoryFlareTemp"
            [ "$debug" = "true" ] || rm -f "$jsonHistoryFlareTemp.combined"
        fi
        #
        # process cloudFlare history files for this data source.
        #
        if ! isJsonArray "$jsonHistoryFlareTemp"; then
            echo "$sourceName $ticker failed to merge cloudFlare facts history, skipping."
        elif ../bin/jsonDifferent.sh "$jsonHistoryFlareTemp" "$jsonHistoryFlare" &&
            publishFacts "$jsonHistoryFlareTemp" "$jsonHistoryFlare" "$csvHistoryFlare"; then
            [ "$quiet" = "true" ] || echo "published updated $sourceName $ticker cloudFlare facts-history files."
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
if ../bin/jsonDifferent.sh "$jsonFactsNew" "$jsonFactsFlare" &&
    publishFacts "$jsonFactsNew" "$jsonFactsFlare" "$csvFactsFlare"; then
    [ "$quiet" = "true" ] || echo "published updated cloudflare $sourceName-facts files."
fi
#
# Merge current tool's current Facts into the All tools Facts file (keeping only best, most recent reported values)
#
rm -f tmp-all-flare.json
if [ -s "$jsonFactsAllFlare" ]; then
    jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonFactsNew" "$jsonFactsAllFlare" >tmp-all-flare-combined.json &&
        sortBest tmp-all-flare-combined.json tmp-all-flare.json latest
    [ "$debug" = "true" ] || rm -f tmp-all-flare-combined.json
else
    echo "$jsonFactsAllFlare cloudFlare file has not been published."
    dir=$(dirname "$jsonFactsAllFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
    sortBest "$jsonFactsNew" tmp-all-flare.json latest
fi
# if the new merged file is different, then publish it.
if ! isJsonArray tmp-all-flare.json; then
    echo "$sourceName failed to merge $jsonFactsAllFlare, not published."
elif ../bin/jsonDifferent.sh tmp-all-flare.json "$jsonFactsAllFlare" &&
    publishFacts tmp-all-flare.json "$jsonFactsAllFlare" "$csvFactsAllFlare"; then
    [ "$quiet" = "true" ] || echo "published updated cloudflare all-facts files."
fi
[ "$debug" = "true" ] || rm -f tmp-all-flare.json
