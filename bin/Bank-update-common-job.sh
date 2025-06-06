#!/usr/bin/bash
#
# This a generic version of the daily yields reports to update with a new and
# better model for handling history. Old version took all tickers/accounts and put in one history file.
# This one is intended to put each ticker in its own history file to reduce size and processing overhead on
# on the read side. more effort on the update side (most likely)
#
# process the command argument list.
pubDelayHours=18
runDelayHours=4
accountClass=Banks
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
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "--injectProcessedJson")
        injectProcessedJson="$2"
        #echo "injectProcessedJson=$injectProcessedJson"
        shift
        ;;
    "--nodearg")
        nodeArg="$2"
        #echo "nodeArg=$nodeArg"
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
jsonRateFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-rate.json"
csvRateFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-rate.csv"

#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but still report the aging status.
#
if [ -n "$injectProcessedJson" ] && [ -s "$injectProcessedJson" ]; then
    echo "Using $injectProcessedJson instead of querying online source."
    jsonRateNew="$injectProcessedJson"
else
    pubDelayFile="$jsonRateFlare"
    runDelayFile="$jsonRateNew"
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
        tmpCollect="tmpCollect.txt"
        #echo "running $collectionScript"
        $collectionScript >"$tmpCollect"
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
    apyNew=$(grep apy "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
    if [ -z "$apyNew" ] || [ "$apyNew" = "null" ]; then
        echo "New $sourceName rate file has empty APY."
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
grep accountType "$jsonRateNew" | sed 's/^.*Type": "//' | sed 's/",$//' | sort -u |
    while IFS= read -r accountType; do
        dirname="history/$(echo "$accountType" | sed -e 's/ /-/g')"
        [ -d "$dirname" ] || mkdir -p "$dirname"
        jsonRateAccountType="$dirname/rate-new.json"
        jsonHistoryUnique="$dirname/history-unique.json"
        jsonHistoryFlare="$cloudFlareHome/$accountClass/$sourceName/$dirname/rate-history.json"

        # now for the line I am processing, I need to pull ONLY those items that are appropriate for this line from jsonRateNew and process from here.
        cat "$jsonRateNew" | jq "[.[] | select(.accountType==\"$accountType\")]" >"$jsonRateAccountType"

        if [ -s "$jsonHistoryFlare" ]; then
            jq -s 'flatten | unique_by([.accountType,.asOfDate]) | sort_by([.accountType,.asOfDate])' "$jsonRateAccountType" "$jsonHistoryFlare" >tmp-flatten.json
            cat tmp-flatten.json | node ../lib/node-bank-gapFiller.js | jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
            rm tmp-flatten.json
        else
            cat "$jsonRateAccountType" | node ../lib/node-bank-gapFiller.js | jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
            echo "$sourceName $accountType cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        fi

        #
        # process cloudFlare account specific history files
        #
        if ../bin/jsonDifferent.sh "$jsonHistoryUnique" "$jsonHistoryFlare"; then
            cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
            echo "published updated $sourceName $accountType cloudFlare history file."
        fi
    done
#
# process the cloudFlare rate file.
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
    echo "published updated $sourceName cloudFlare .json rate file."
    (
        echo 'asOfDate,accountType,apy'
        jq -r '.[] | [.asOfDate, .accountType, .apy] | @csv' "$jsonRateFlare"
    ) >"$csvRateFlare"
    echo "published updated $sourceName cloudFlare .csv rate file."
fi
#
# XXXXX This section is transitional until I can upgrade all users to a version that does not depend on the merged history file.
#
#
# Process the daily history results in rate and merge with history.
#
jsonHistoryUnique="$sourceName-history-unique.json"
jsonHistoryFlare="$cloudFlareHome/$accountClass/$sourceName/$sourceName-history.json"

if [ -s "$jsonHistoryFlare" ]; then
    jq -s 'flatten | unique_by([.accountType,.asOfDate]) | sort_by([.accountType,.asOfDate])' "$jsonRateNew" "$jsonHistoryFlare" |
        node ../lib/node-bank-gapFiller.js |
        jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
else
    cat "$jsonRateNew" |
        node ../lib/node-bank-gapFiller.js |
        jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
    echo "$sourceName cloudFlare history file has not been published."
    dir=$(dirname "$jsonHistoryFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#
# process cloudFlare history files
#
if ../bin/jsonDifferent.sh "$jsonHistoryUnique" "$jsonHistoryFlare"; then
    cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
    echo "published updated $sourceName cloudFlare history file."
fi
exit 0
