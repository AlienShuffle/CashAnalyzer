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
    "--forceOverwrite")
        forceOverwrite=true
        echo "forceOverwrite=$forceOverwrite"
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

# this allows the script to overwrite existing files if the --forceOverwrite flag is set.
if [ -n "$forceOverwrite" ]; then
    protectOverwrite=false
fi

# if a sourceName is not specified, use the current directory name.
if [ -z "$sourceName" ]; then
    sourceName=$(basename $(pwd))
fi

# create data source file paths.
[ -d history ] || mkdir history
jsonRateNew="history/$sourceName-rate-new.json"
jsonRateFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-rates.json"
csvRateFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-rates.csv"
jsonRateAllFlare="$cloudFlareHome/$accountClass/all-rates.json"
csvRateAllFlare="$cloudFlareHome/$accountClass/all-rates.csv"
csvHeader='asOfDate,ticker,oneDayYield,sevenDayYield,thirtyDayYield,source'
csvElements='.[] | [.asOfDate, .ticker, .oneDayYield, .sevenDayYield, .thirtyDayYield,.source] | @csv'
#
# debug support - merge failures are logged to stdout (captured by job-control) and to $debugLog,
# and the inputs/outputs/stderr of the failed step are preserved in $debugDir/<runId>-<step>[-<ticker>]/
#
debugDir="debug"
debugLog="$debugDir/merge-debug.log"
[ -d "$debugDir" ] || mkdir -p "$debugDir"
find "$debugDir" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null
runId="$(date +%Y%m%d-%H%M%S)-$$"
errFile="$debugDir/stderr-$$.txt"
trap 'rm -f "$errFile"' EXIT

logDebug() {
    local msg
    msg="$(date '+%F %T') [$sourceName pid=$$] $*"
    echo "$msg" >>"$debugLog"
    echo "$msg"
}
fileInfo() {
    if [ -e "$1" ]; then
        echo "size=$(stat -c %s "$1") mtime=$(stat -c %y "$1" | cut -d. -f1) type=$(jq -e -r 'type + "[" + (length|tostring) + "]"' "$1" 2>/dev/null || echo INVALID-JSON)"
    else
        echo "missing"
    fi
}
# usage: stepFailed <step> <ticker> <pipeStatuses> <outputFile> [inputFiles...]
stepFailed() {
    local step="$1" ticker="$2" statuses="$3" output="$4" f dir
    shift 4
    dir="$debugDir/$runId-$step${ticker:+-${ticker// /-}}"
    mkdir -p "$dir"
    logDebug "STEP FAILED step=$step ticker=${ticker:-n/a} pipeStatus=[$statuses]"
    for f in "$@" "$output"; do
        logDebug "    $f: $(fileInfo "$f")"
        [ -e "$f" ] && cp -p "$f" "$dir/"
    done
    if [ -s "$errFile" ]; then
        sed 's/^/    stderr: /' "$errFile" | tee -a "$debugLog"
        cp "$errFile" "$dir/stderr.txt"
    fi
    logDebug "    debug copies saved in $(pwd)/$dir"
}
# usage: mmSortBest <inFile> <outFile> [latest]  - sets statuses=(nodeStatus)
mmSortBest() {
    node ../lib/node-MM-sortBest.js ${3:+"$3"} --input "$1" --output "$2" 2>>"$errFile"
    statuses=("$?")
    pipeOk "${statuses[@]}"
}
# atomically replace a published json file (and its csv), refusing to publish empty or invalid json.
publishJson() {
    local src="$1" dest="$2" csvDest="$3"
    if ! isJsonArray "$src"; then
        logDebug "REFUSED to publish $dest from $src: $(fileInfo "$src")"
        stepFailed "publish" "$(basename "$dest" .json)" "n/a" "$src" "$dest"
        return 1
    fi
    cp "$src" "$dest.tmp.$$" && mv -f "$dest.tmp.$$" "$dest" || {
        logDebug "failed to write $dest"
        rm -f "$dest.tmp.$$"
        return 1
    }
    if [ -n "$csvDest" ]; then
        {
            echo "$csvHeader"
            jq -r "$csvElements" "$dest"
        } >"$csvDest.tmp.$$" && mv -f "$csvDest.tmp.$$" "$csvDest" || {
            logDebug "failed to write $csvDest"
            rm -f "$csvDest.tmp.$$"
            return 1
        }
    fi
}
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but still report the aging status.
#
if [ -n "$injectProcessedJson" ] && [ -s "$injectProcessedJson" ]; then
    echo "Using $injectProcessedJson instead of querying online source."
    jsonRateNew="$injectProcessedJson"
    if isEmptyJsonArray "$jsonRateNew"; then
        logDebug "NO REPORTABLE YIELDS in $jsonRateNew; skipping publish."
        exit 0
    fi
else
    source ../bin/skipWeekends.sh
    pubDelayFile="$jsonRateFlare"
    runDelayFile="$jsonRateNew"
    source ../bin/testDelays.sh
    #
    # run the scipts to prepare the data.
    #
    # if a script file is not specified, try a default name.
    if [ -z "$processScript" ]; then
        processScript="./node-$sourceName-update.js"
        if [ ! -s "$processScript" ]; then
            processScript="./node-$sourceName-yield-update.js"
        fi
        if [ ! -s "$processScript" ]; then
            echo "Missing $processScript file."
            exit 1
        fi
    fi
    if [ "$collectionScript" ]; then
        if [ ! -x "$collectionScript" ]; then
            echo "invalid collectionScript $collectionScript, exiting..."
            exit 1
        fi
        tmpCollect="tmpCollect.json"
        #echo "running $collectionScript"
        : >"$errFile"
        if [ -n "$collectionArg" ]; then
            $collectionScript "$collectionArg" >"$tmpCollect" 2>>"$errFile"
        else
            $collectionScript >"$tmpCollect" 2>>"$errFile"
        fi
        statuses=("${PIPESTATUS[@]}")
        if [ "${statuses[0]}" -ne 0 ]; then
            stepFailed "collect" "" "${statuses[*]}" "$tmpCollect"
            echo "$sourceName rate retrieval failed, exiting."
            exit 1
        fi
        if [ ! -s "$tmpCollect" ]; then
            echo "Empty collection File $tmpCollect."
            exit 1
        fi
        #echo "running node $processScript"
        : >"$errFile"
        if ! runNode "$jsonRateNew" "$tmpCollect" $processScript "$nodeArg"; then
            stepFailed "process" "" "${statuses[*]}" "$jsonRateNew" "$tmpCollect" "$jsonRateNew.raw"
            rm -f "$tmpCollect" "$jsonRateNew.raw"
            echo "$sourceName rate retrieval failed, exiting."
            exit 1
        fi
        rm -f "$tmpCollect"
    else
        #echo "node $processScript $nodeArg | jq . >$jsonRateNew"; exit 1
        : >"$errFile"
        if ! runNode "$jsonRateNew" - $processScript "$nodeArg"; then
            stepFailed "process" "" "${statuses[*]}" "$jsonRateNew" "$jsonRateNew.raw"
            rm -f "$jsonRateNew.raw"
            echo "$sourceName rate retrieval failed, exiting."
            exit 1
        fi
    fi
    if [ ! -s "$jsonRateNew" ]; then
        echo "Empty $sourceName rate file."
        exit 1
    fi
    yieldNew=$(grep DayYield "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
    if [ -z "$yieldNew" ] || [ "$yieldNew" = "null" ]; then
        echo "New $sourceName rate file has empty yields."
        exit 1
    fi
fi
# sort/normalize the file now.
: >"$errFile"
jq 'sort_by([.accountType,.asOfDate])' "$jsonRateNew" >tmp.sort.json 2>>"$errFile"
sortStatus=$?
if [ "$sortStatus" -ne 0 ] || ! isJsonArray tmp.sort.json; then
    stepFailed "sort-new" "" "$sortStatus" tmp.sort.json "$jsonRateNew"
    rm -f tmp.sort.json
    echo "$sourceName failed to sort $jsonRateNew, exiting."
    exit 1
fi
cat tmp.sort.json >"$jsonRateNew"
#cat $jsonRateNew
rm -f tmp.sort.json
#
# Everything from here on reads and writes files shared by all $accountClass sources in cloudflare.
# Serialize with any other job doing the same so nobody reads a file while it is being rewritten.
#
lockFile="${TMPDIR:-/tmp}/CashAnalyzer-$accountClass-publish.lock"
exec 9>"$lockFile"
if ! flock -n 9; then
    logDebug "LOCK CONTENTION: another $accountClass job holds $lockFile ($(fuser "$lockFile" 2>/dev/null)), waiting..."
    if ! flock -w 1800 9; then
        logDebug "could not acquire $lockFile after 1800s, exiting."
        exit 1
    fi
    logDebug "acquired $lockFile after waiting."
fi
#
# Process the daily history results in rate and merge with history.
#
# get list of rates that were updated.
# Then loop through this list of names, extract them from the rate sheet and merge it into the history sheet.
#
grep ticker "$jsonRateNew" | sed 's/^.*ticker": "//' | sed -e 's/",$//' | sed -e 's/"$//' | sort -u |
    while IFS= read -r ticker; do
        dirname="$(echo "$ticker" | sed -e 's/ /-/g')"
        [ "$quiet" = "true" ] || echo "Processing rates: $ticker yields"
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
        : >"$errFile"
        jq "[.[] | select(.ticker==\"$ticker\")]" "$jsonRateNew" >"$jsonRateTicker" 2>>"$errFile"
        stepStatus=$?
        if [ "$stepStatus" -ne 0 ] || ! isJsonArray "$jsonRateTicker"; then
            stepFailed "extract-ticker" "$ticker" "$stepStatus" "$jsonRateTicker" "$jsonRateNew"
            continue
        fi

        # sort/filter/gap fill the combined history and current date's rates using only this tool's data.
        : >"$errFile"
        if [ -f "$jsonHistoryUnique" ]; then
            #echo "$sourceName $ticker unique file exists, sorting it in."
            jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonRateTicker" "$jsonHistoryUnique" >"$jsonHistoryTemp" 2>>"$errFile"
        else
            cat "$jsonRateTicker" >"$jsonHistoryTemp"
        fi
        stepStatus=$?
        if [ "$stepStatus" -ne 0 ] || ! isJsonArray "$jsonHistoryTemp"; then
            stepFailed "unique-combine" "$ticker" "$stepStatus" "$jsonHistoryTemp" "$jsonRateTicker" "$jsonHistoryUnique"
            rm -f "$jsonHistoryTemp"
            continue
        fi
        if ! mmSortBest "$jsonHistoryTemp" "$jsonHistoryUnique.new" || ! isJsonArray "$jsonHistoryUnique.new"; then
            stepFailed "unique-sortBest" "$ticker" "${statuses[*]}" "$jsonHistoryUnique.new" "$jsonHistoryTemp" "$jsonHistoryUnique"
            rm -f "$jsonHistoryTemp" "$jsonHistoryUnique.new"
            continue
        fi
        mv -f "$jsonHistoryUnique.new" "$jsonHistoryUnique"
        rm "$jsonHistoryTemp"

        # sort/filter/gapfill this combined history with data from all sources in cloudflare repository.
        rm -f "$jsonHistoryFlareTemp"
        : >"$errFile"
        if [ ! -s "$jsonHistoryFlare" ]; then
            echo "$sourceName $ticker cloudFlare history file has not been published."
            if [ "$protectOverwrite" = "true" ]; then
                echo "skipping merge as $sourceName $ticker cloudFlare history file does not exist."
                [ -e "$jsonHistoryFlare" ] && logDebug "$jsonHistoryFlare exists but is EMPTY: $(fileInfo "$jsonHistoryFlare")"
            else
                if ! mmSortBest "$jsonHistoryUnique" "$jsonHistoryFlareTemp" || ! isJsonArray "$jsonHistoryFlareTemp"; then
                    stepFailed "flare-new" "$ticker" "${statuses[*]}" "$jsonHistoryFlareTemp" "$jsonHistoryUnique"
                    rm -f "$jsonHistoryFlareTemp"
                fi
            fi

            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        else
            # snapshot the shared file first so the debug copy is exactly what was merged.
            cp -p "$jsonHistoryFlare" "$jsonHistoryFlareTemp.in"
            jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonHistoryUnique" "$jsonHistoryFlareTemp.in" >"$jsonHistoryFlareTemp.combined" 2>>"$errFile"
            stepStatus=$?
            if [ "$stepStatus" -ne 0 ] || ! isJsonArray "$jsonHistoryFlareTemp.combined"; then
                stepFailed "flare-combine" "$ticker" "$stepStatus" "$jsonHistoryFlareTemp.combined" "$jsonHistoryUnique" "$jsonHistoryFlareTemp.in"
            elif ! mmSortBest "$jsonHistoryFlareTemp.combined" "$jsonHistoryFlareTemp" || ! isJsonArray "$jsonHistoryFlareTemp"; then
                stepFailed "flare-merge" "$ticker" "${statuses[*]}" "$jsonHistoryFlareTemp" "$jsonHistoryUnique" "$jsonHistoryFlareTemp.in" "$jsonHistoryFlareTemp.combined"
                rm -f "$jsonHistoryFlareTemp"
            fi
            rm -f "$jsonHistoryFlareTemp.in" "$jsonHistoryFlareTemp.combined"
        fi
        #
        # process cloudFlare history files for this data source.
        #
        if { [ "$protectOverwrite" != "true" ] || [ -s "$jsonHistoryFlare" ]; } &&
            [ -s "$jsonHistoryFlareTemp" ] &&
            ../bin/jsonDifferent.sh "$jsonHistoryFlareTemp" "$jsonHistoryFlare"; then
            if publishJson "$jsonHistoryFlareTemp" "$jsonHistoryFlare" "$csvHistoryFlare"; then
                [ "$quiet" = "true" ] || echo "published updated $sourceName $ticker cloudFlare yield files."
            fi
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
    if [ "$protectOverwrite" = "true" ]; then
        echo "skipping merge as $sourceName cloudFlare rate file does not exist."
    fi
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
if { [ "$protectOverwrite" != "true" ] || [ -s "$jsonRateFlare" ]; } && ../bin/jsonDifferent.sh "$jsonRateNew" "$jsonRateFlare"; then
    if publishJson "$jsonRateNew" "$jsonRateFlare" "$csvRateFlare"; then
        [ "$quiet" = "true" ] || echo "published updated cloudflare $sourceName-rates files."
    fi
fi
#
# Merge current tool's current rates into the All tools rate file (keeping only best, most recent reported values)
#
rm -f tmp-all-flare.json
: >"$errFile"
if [ -s "$jsonRateAllFlare" ]; then
    cp -p "$jsonRateAllFlare" tmp-all-flare-in.json
    jq -s 'flatten | sort_by([.ticker,.asOfDate])' "$jsonRateNew" tmp-all-flare-in.json >tmp-all-flare-combined.json 2>>"$errFile"
    stepStatus=$?
    if [ "$stepStatus" -ne 0 ] || ! isJsonArray tmp-all-flare-combined.json; then
        stepFailed "all-rates-combine" "" "$stepStatus" tmp-all-flare-combined.json "$jsonRateNew" tmp-all-flare-in.json
    elif ! mmSortBest tmp-all-flare-combined.json tmp-all-flare.json latest || ! isJsonArray tmp-all-flare.json; then
        stepFailed "all-rates-merge" "" "${statuses[*]}" tmp-all-flare.json "$jsonRateNew" tmp-all-flare-in.json tmp-all-flare-combined.json
        rm -f tmp-all-flare.json
    fi
    rm -f tmp-all-flare-in.json tmp-all-flare-combined.json
else
    echo "$jsonRateAllFlare cloudFlare file has not been published."
    [ -e "$jsonRateAllFlare" ] && logDebug "$jsonRateAllFlare exists but is EMPTY: $(fileInfo "$jsonRateAllFlare")"
    if [ "$protectOverwrite" = "true" ]; then
        echo "skipping merge as $jsonRateAllFlare does not exist."
    else
        if ! mmSortBest "$jsonRateNew" tmp-all-flare.json latest || ! isJsonArray tmp-all-flare.json; then
            stepFailed "all-rates-new" "" "${statuses[*]}" tmp-all-flare.json "$jsonRateNew"
            rm -f tmp-all-flare.json
        fi
    fi
    dir=$(dirname "$jsonRateAllFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
# if the new merged file is different, then publish it.
if { [ "$protectOverwrite" != "true" ] || [ -s "$jsonRateAllFlare" ]; } &&
    [ -s tmp-all-flare.json ] &&
    ../bin/jsonDifferent.sh tmp-all-flare.json "$jsonRateAllFlare"; then
    if publishJson tmp-all-flare.json "$jsonRateAllFlare" "$csvRateAllFlare"; then
        [ "$quiet" = "true" ] || echo "published updated cloudflare all-rates files."
    fi
fi
rm -f tmp-all-flare.json
