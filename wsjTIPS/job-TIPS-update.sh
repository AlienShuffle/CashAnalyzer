#!/usr/bin/bash
#
# This tool now  updates the TIPS data on the cloudflare site and Google Drive.
# Google Drive target removed.
#
# process the command argument list.
pubDelayHours=18
runDelayHours=2
sourceName=$(basename $(pwd))
while [ -n "$1" ]; do
    case $1 in
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
    "-sourceName")
        sourceName="$2"
        #echo "sourceName=$sourceName"
        shift
        ;;
    esac
    shift
done
if [ -z "$sourceName" ]; then
    echo "$0: -b sourceName missing, need to specify a valid bank."
    exit 1
fi
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
    source ../bin/skipWeekends.sh
    pubDelayFile="$jsonRateFlare"
    runDelayFile="$jsonRateNew"
    source ../bin/testDelays.sh

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
grep key "$jsonRateNew" | sed 's/^.*key": "//' | sed 's/"$//' | sort -u |
    while IFS= read -r tipsKey; do
        dirname="history/$(echo "$tipsKey" | sed -e 's/ /-/g')"
        #echo "Processing $tipsKey"
        [ -d "$dirname" ] || mkdir -p "$dirname"
        jsonRatetipsKey="$dirname/rate-new.json"
        jsonHistoryUnique="$dirname/history-unique.json"
        jsonHistoryFlare="$cloudFlareHome/Treasuries/$sourceName/$dirname/rate-history.json"
        csvHistoryFlare="$cloudFlareHome/Treasuries/$sourceName/$dirname/rate-history.csv"

        # now for the line I am processing, I need to pull ONLY those items that are appropriate for this line from jsonRateNew and process from here.
        cat "$jsonRateNew" | jq "[.[] | select(.key==\"$tipsKey\")]" >"$jsonRatetipsKey"

        if [ -s "$jsonHistoryFlare" ]; then
            jq -s 'flatten | unique_by([.key,.asOfDate]) | sort_by([.key,.asOfDate])' "$jsonRatetipsKey" "$jsonHistoryFlare" |
                jq 'sort_by([.key,.asOfDate])' >"$jsonHistoryUnique"
        else
            cat "$jsonRatetipsKey" | jq 'sort_by([.key,.asOfDate])' >"$jsonHistoryUnique"
            echo "$sourceName cloudFlare history file has not been published."
            dir=$(dirname "$jsonHistoryFlare")
            [ -d "$dir" ] || mkdir -p "$dir"
        fi
        #
        # cloudFlare publish history file
        #
        if ../bin/jsonDifferent.sh "$jsonHistoryUnique" "$jsonHistoryFlare"; then
            cat "$jsonHistoryUnique" >"$jsonHistoryFlare"
            # save the history file as a .csv as well.
            (
                echo 'asOfDate,maturity,coupon,bid,asked,chg,yield,accruedprincipal,key'
                jq -r '.[] | [.asOfDate, .maturity, .coupon, .bid, .asked, .chg, .yield, .accruedprincipal, .key] | @csv' "$jsonHistoryUnique"
            ) >"$csvHistoryFlare"
            echo "published updated $sourceName $tipsKey cloudFlare history file."
        fi
    done
###################################
#
# process the rate file.
#
dates=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dates" ]; then
    echo "New $sourceName rate file does not include dates."
    exit 1
fi
#
# publish cloudFlare Rate files
#
if [ ! -s "$jsonRateFlare" ]; then
    echo "$sourceName cloudFlare rate file has not been published."
    dir=$(dirname "$jsonRateFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
fi
dailyFolder="$cloudFlareHome/Treasuries/$sourceName/daily"
[ -d "$dailyFolder" ] || mkdir -p "$dailyFolder"
if ../bin/jsonDifferent.sh "$jsonRateNew" "$jsonRateFlare"; then
    cat "$jsonRateNew" >"$jsonRateFlare"
    # save the data file as a .csv as well.
    (
        echo 'asOfDate,maturity,coupon,bid,asked,chg,yield,accruedprincipal,key'
        jq -r '.[] | [.asOfDate, .maturity, .coupon, .bid, .asked, .chg, .yield, .accruedprincipal, .key] | @csv' "$jsonRateNew"
    ) >"$csvRateFlare"
    echo "published updated $sourceName cloudFlare rate file."
    asOfDate=$(jq -r '.[] | .asOfDate' "$jsonRateFlare" | sort -u)
    dailyRateFile="$dailyFolder/$asOfDate-rate.json"
    dailyRateCSV="$dailyFolder/$asOfDate-rate.CSV"
    cat "$jsonRateFlare" >"$dailyRateFile"
    cat "$csvRateFlare" >"$dailyRateCSV"

fi
exit 0
