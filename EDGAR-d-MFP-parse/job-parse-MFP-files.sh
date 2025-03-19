#!/usr/bin/bash
#
# This processes the list of EDGAR submissions files and pulls out a list of
# MFP reports eligible for processing.
#
# process the command argument list.
pubDelayHours=48
runDelayHours=48
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

MFPFilesDir="../EDGAR-c-MFP-lists/MFP-files"
if [ ! -d "$MFPFilesDir" ]; then
    echo "$MFPFilesDir does not exist, exiting..."
    exit 1
fi
CIKmap="../EDGAR-a-CIK/CIK/CIK-map.json"
if [ ! -s "$CIKmap" ]; then
    echo "$CIKmap does not exist, exiting..."
    exit 1
fi
fiscalYears="../EDGAR-b-submissions/fiscalYearFile.csv"
if [ ! -s "$fiscalYears" ]; then
    echo "$fiscalYears does not exist, exiting..."
    exit 1
fi
monthlyReport="reports"

find $MFPFilesDir -type f -name '*.xml' -print |
    while read -r xmlFile; do
        cikDir="$monthlyReport/$(dirname $xmlFile | sed -e 's/^.*\///')"
        [ -d "$cikDir" ] || mkdir -p "$cikDir"
        newFile="$cikDir/$(basename $xmlFile | sed -e 's/\.xml/\.json/')"
        if [ -n "$forceRun" ] || [ ! -s "$newFile" ] || [ "$xmlFile" -nt "$newFile" ]; then
            echo processing $xmlFile
            node node-parse-MFP-file.js "$CIKmap" "$fiscalYears" <"$xmlFile" | jq . >"$newFile"
        fi
    done
exit 0
