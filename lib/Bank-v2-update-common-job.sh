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
injectRatesJson="inject-rates.json"
jsonRateNew="$bankName-rate-new.json"
jsonRateFlare="$cloudFlareHome/Banks/$bankName/$bankName-rate.json"
csvRateFlare="$cloudFlareHome/Banks/$bankName/$bankName-rate.csv"
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
    apyNew=$(grep apy "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
    if [ -z "$apyNew" ] || [ "$apyNew" = "null" ]; then
        echo "New $bankName rate file has empty APY."
        exit 1
    fi
fi
#
# Process the daily history results in rate and merge with history.
#
# get list of rates that were updated.
# Then loop through this list of names, extract them from the rate sheet and merge it into the history sheet.
#
grep accountType "$jsonRateNew" | sed 's/^.*Type": "//' | sed 's/",$//' | sort -u |
    while IFS= read -r accountType; do
        dirname="history/$(echo "$accountType" | sed -e 's/ /-/g')"
        echo "Processing $accountType"
        [ -d "$dirname" ] || mkdir -p "$dirname"
        jsonRateAccountType="$dirname/rate-new.json"
        jsonHistoryUnique="$dirname/history-unique.json"
        jsonHistoryFlare="$cloudFlareHome/Banks/$bankName/$dirname/rate-history.json"
        #echo jsonHistoryUnique=$jsonHistoryUnique
        #echo jsonHistoryFlare=$jsonHistoryFlare

        # now for the line I am processing, I need to pull ONLY those items that are appropriate for this line from jsonRateNew and process from here.
        cat "$jsonRateNew" | jq "[.[] | select(.accountType==\"$accountType\")]" >"$jsonRateAccountType"

        if [ -f "$jsonHistoryFlare" ]; then
            jq -s 'flatten | unique_by([.accountType,.asOfDate]) | sort_by([.accountType,.asOfDate])' "$jsonRateAccountType" "$jsonHistoryFlare" >tmp-flatten.json
            cat tmp-flatten.json | node ../lib/node-bank-gapFiller.js | jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
            rm tmp-flatten.json
        else
            cat "$jsonRateAccountType" | node ../lib/node-bank-gapFiller.js | jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
        fi

        #
        # process cloudFlare history files
        #
        lenHistoryUnique=$(grep -o apy "$jsonHistoryUnique" | wc -l)
        if [ -s "$jsonHistoryFlare" ]; then
            lenHistoryFlare=$(grep -o apy "$jsonHistoryFlare" | wc -l)
        else
            lenHistoryFlare=0
            echo "$bankName $accountType cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        fi
        #echo "entries new($lenHistoryUnique) :: flare($lenHistoryFlare)"
        if [ $lenHistoryUnique -gt $lenHistoryFlare ]; then
            cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
            echo "published updated $bankName $accountType cloudFlare history file."
        fi
    done
#
# process the cloudFlare rate file.
#
if [ -s "$jsonRateFlare" ]; then
    dateFlare=$(grep asOfDate "$jsonRateFlare" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
    dateFlare=""
    echo "$bankName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
#echodateFlare=$dateFlare
if [[ $dateFlare < $dateNew ]]; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    echo "published updated $bankName cloudFlare .json rate file."
    (
        echo 'asOfDate,accountType,apy'
        jq -r '.[] | [.asOfDate, .accountType, .apy] | @csv' "$jsonRateNew"
    ) >"$csvRateFlare"
    echo "published updated $bankName cloudFlare .csv rate file."
fi
#
# XXXXX This section is transitional until I can upgrade all users to a version that does not depend on the merged history file.
#
#
# Process the daily history results in rate and merge with history.
#
jsonHistoryUnique="$bankName-history-unique.json"
jsonHistoryFlare="$cloudFlareHome/Banks/$bankName/$bankName-history.json"
#echo jsonHistoryUnique=$jsonHistoryUnique
#echo jsonHistoryFlare=$jsonHistoryFlare

if [ -f "$jsonHistoryFlare" ]; then
    rm -f tmp-flatten.json
    echo create tmp-flatten.json
    jq -s 'flatten | unique_by([.accountType,.asOfDate]) | sort_by([.accountType,.asOfDate])' "$jsonRateNew" "$jsonHistoryFlare" >tmp-flatten.json
    echo gapFilling tmp-flatten.json
    cat tmp-flatten.json | node ../lib/node-bank-gapFiller.js | jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
    rm tmp-flatten.json
else
    echo gapFilling $jsonRateNew
    cat "$jsonRateNew" | node ../lib/node-bank-gapFiller.js | jq 'sort_by([.accountType,.asOfDate])' >"$jsonHistoryUnique"
fi
#
# process cloudFlare history files
#
lenHistoryUnique=$(grep -o apy "$jsonHistoryUnique" | wc -l)
if [ -s "$jsonHistoryFlare" ]; then
    lenHistoryFlare=$(grep -o apy "$jsonHistoryFlare" | wc -l)
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
exit 0