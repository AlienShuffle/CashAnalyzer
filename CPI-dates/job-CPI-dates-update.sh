#!/usr/bin/bash
#
# This tool updates the CPI-release dates data on the cloudflare site.
#
# process the command argument list.
# run 24 days after last publish, and only after 9am, 4 hours after if missed.
pubDelayHours="$(echo "24 * 24" | bc)"
runDelayHours=4
nightDelayHour=9
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
    "--nightDelayHour")
        nightDelayHour="$2"
        echo "nightDelayHour=$nightDelayHour"
        shift
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
    "--sourceName")
        sourceName="$2"
        #echo "sourceName=$sourceName"
        shift
        ;;
    esac
    shift
done
if [ -z "$sourceName" ]; then
    sourceName=$(basename $(pwd))
fi
if [ ! -d "$HOME/CashAnalyzer/$sourceName" ]; then
    echo "$0: $sourceName is not a valid CPI script name."
    exit 1
fi
# look for a -f to force run, overriding the time delays.

source ../meta.common.sh
# current rate files
jsonNew="$sourceName-new.json"
jsonFlare="$cloudFlareHome/Treasuries/$sourceName.json"
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but report the aging status too.
#
# update the delayHours values as appropriate for the data source.
pubDelayFile="$jsonFlare"
runDelayFile="$jsonNew"
source ../bin/testDelays.sh
#
# find the script file.
#
scriptFile="./node-$sourceName-update.js"
if [ ! -s "$scriptFile" ]; then
    scriptFile="./node-$sourceName-update.mjs"
    if [ ! -s "$scriptFile" ]; then
        echo "Missing $scriptFile file."
        exit 1
    fi
fi
node $scriptFile "$nodeArg" >"$jsonNew"
if [ ! $? ]; then
    echo "$sourceName rate retrieval failed, exiting."
    exit 1
fi
if [ ! -s "$jsonNew" ]; then
    echo "Empty $sourceName file."
    exit 1
fi
#
# publish cloudFlare file
#
if [ ! -s "$jsonFlare" ]; then
    echo "$sourceName cloudFlare file had not been published."
    dir=$(dirname "$jsonFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
    jq . "$jsonNew" >"$jsonFlare"
    echo "published updated $sourceName cloudFlare file."
else
    if diff "$jsonNew" "$jsonFlare" >/dev/null; then
        echo "$sourceName file has not changed since last publish."
    else
        jq . "$jsonNew" >"$jsonFlare"
        echo "published updated $sourceName cloudFlare file."
    fi
fi
exit 0
