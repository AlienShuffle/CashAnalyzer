#!/usr/bin/bash
#
# This tool now updates the REFCPI data on the cloudflare site.
#
# process the command argument list.
# run 24 days after last publish, and only after 9am, 4 hours after if missed.
pubDelayHours=20
runDelayHours=4
nightDelayHour=6
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
cvsNew="$sourceName-new.csv"
cvsFlare="$cloudFlareHome/Treasuries/$sourceName.csv"
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if -f is passed to this script, I will run the script regardless, but report the aging status too.
#
# update the delayHours values as appropriate for the data source.
pubDelayFile="$cvsFlare"
runDelayFile="$cvsNew"
source ../bin/testDelays.sh
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
scriptFile="./node-$sourceName-update.js"
if [ ! -s "$scriptFile" ]; then
    echo "Missing $scriptFile file."
    exit 1
fi
node $scriptFile "$nodeArg" >"$cvsNew"
if [ ! $? ]; then
    echo "$sourceName rate retrieval failed, exiting."
    exit 1
fi
if [ ! -s "$cvsNew" ]; then
    echo "Empty $sourceName file."
    exit 1
fi
#
# publish cloudFlare file
#
if [ ! -s "$cvsFlare" ]; then
    echo "$sourceName cloudFlare file had not been published."
    dir=$(dirname "$cvsFlare")
    [ -d "$dir" ] || mkdir -p "$dir"
    cat "$cvsNew" >"$cvsFlare"
    echo "published updated $sourceName cloudFlare file."
else
    if diff "$cvsNew" "$cvsFlare" >/dev/null; then
        echo "$sourceName file has not changed since last publish."
    else
        cat "$cvsNew" >"$cvsFlare"
        echo "published updated $sourceName cloudFlare file."
    fi
fi
exit 0
