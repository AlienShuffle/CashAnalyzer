#!/usr/bin/bash
#
# This tool now  updates the TIPS data on the cloudflare site and Google Drive.
# Google Drive target removed.
#
# process the command argument list.
pubDelayHours=18
runDelayHours=2
bankName=$(basename $(pwd))
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
jsonRateFlare="$cloudFlareHome/Treasuries/$bankName/$bankName-rate.json"
csvRateFlare="$cloudFlareHome/Treasuries/$bankName/$bankName-rate.csv"
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
    dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
    if [ -z "$dateNew" ] || [ "$dateNew" = "null" ]; then
        echo "New $bankName rate file has empty timestamps."
        exit 1
    fi
fi
#
# Process the daily history results in rate and merge with history.
#
##################################
grep key "$jsonRateNew" | sed 's/^.*key": "//' | sed 's/"$//' | sort -u |
    while IFS= read -r tipsKey; do
        dirname="history/$(echo "$tipsKey" | sed -e 's/ /-/g')"
        echo "Processing $tipsKey"
        [ -d "$dirname" ] || mkdir -p "$dirname"
        jsonRatetipsKey="$dirname/rate-new.json"
        jsonHistoryUnique="$dirname/history-unique.json"
        jsonHistoryFlare="$cloudFlareHome/Treasuries/$bankName/$dirname/rate-history.json"
        csvHistoryFlare="$cloudFlareHome/Treasuries/$bankName/$dirname/rate-history.csv"

        # now for the line I am processing, I need to pull ONLY those items that are appropriate for this line from jsonRateNew and process from here.
        cat "$jsonRateNew" | jq "[.[] | select(.key==\"$tipsKey\")]" >"$jsonRatetipsKey"

        if [ -s "$jsonHistoryFlare" ]; then
            jq -s 'flatten | unique_by([.key,.asOfDate]) | sort_by([.key,.asOfDate])' "$jsonRatetipsKey" "$jsonHistoryFlare" |
                jq 'sort_by([.key,.asOfDate])' >"$jsonHistoryUnique"
        else
            cat "$jsonRatetipsKey" | jq 'sort_by([.key,.asOfDate])' >"$jsonHistoryUnique"
            echo "$bankName cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        fi
        #
        # cloudFlare publish history file
        #
        if ../lib/jsonDifferent.sh "$jsonHistoryUnique" "$jsonHistoryFlare"; then
            cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
            # save the history file as a .csv as well.
            (
                echo 'asOfDate,maturity,coupon,bid,asked,chg,yield,accruedprincipal,key'
                jq -r '.[] | [.asOfDate, .maturity, .coupon, .bid, .asked, .chg, .yield, .accruedprincipal, .key] | @csv' "$jsonHistoryUnique"
            ) >"$csvHistoryFlare"
            echo "published updated $bankName cloudFlare history file."
        fi
    done
###################################
#
# process the rate file.
#
if [ -z "$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')" ]; then
    echo "New $bankName rate file does not include dates."
    exit 1
fi
#
# publish cloudFlare Rate files
#
if [ ! -s "$jsonRateFlare" ]; then
    echo "$bankName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
if ../lib/jsonDifferent.sh "$jsonRateNew" "$jsonRateFlare"; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    # save the data file as a .csv as well.
    (
        echo 'asOfDate,maturity,coupon,bid,asked,chg,yield,accruedprincipal,key'
        jq -r '.[] | [.asOfDate, .maturity, .coupon, .bid, .asked, .chg, .yield, .accruedprincipal, .key] | @csv' "$jsonRateNew"
    ) >"$csvRateFlare"
    echo "published updated $bankName cloudFlare rate file."
fi
exit 0
