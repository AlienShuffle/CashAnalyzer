#!/usr/bin/bash
#
# This script creates a list of submissions pages to download from EDGAR.
# this is just the list of URLs to do the work.
#
# process the command argument list.
pubDelayHours=144
runDelayHours=24
accountClass=MM
while [ -n "$1" ]; do
    case $1 in
    "--accountClass")
        accountClass="$2"
        #echo "accountClass=$accountClass"
        shift
        ;;
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "--pubDelay")
        pubDelayHours="$2"
        #echo "pubDelayHours=$pubDelayHours"
        shift
        ;;
    "--runDelay")
        runDelayHours="$2"
        #echo "runDelayHours=$runDelayHours"
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

runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ -s "$fiscalYearFile" ]; then
    if [ "$(($(date +"%s") - $(stat -c "%Y" "$fiscalYearFile")))" -lt "$runDelaySeconds" ]; then
        echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$fiscalYearFile" | cut -d: -f1,2)"
        [ -z "$forceRun" ] && exit 0
    fi
fi

if [ -s "$fiscalYearFile" ]; then
    newCount=$(find submissions -name '*.json' -newer $fiscalYearFile -print | wc -l)
    if [ "$newCount" -eq "0" ]; then
        echo "$fiscalYearFile sources not updated since last run."
        [ -z "$forceRun" ] && exit 0
    fi
fi

# the actual parsing.
for file in submissions/*.json; do
    node node-CIK-fiscalYear.js <$file
done >$fiscalYearFile
