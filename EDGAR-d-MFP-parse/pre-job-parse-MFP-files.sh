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
monthlyReport="reports"
#
# nothing but the node row have been updated, full logic of source files needs to be worked.
#
find $MFPFilesDir -type f -name '*.xml' -print |
    while read -r xmlFile; do
        cikDir="$monthlyReport/$(dirname $xmlFile | sed -e 's/^.*\///')"
        [ -d "$cikDir" ] || mkdir -p "$cikDir"
        newFile="$cikDir/$(basename $xmlFile | sed -e 's/\.xml/\.json/')"
        echo cikDir=$cikDir
        echo newFile=$newFile
        if [ -n "$forceRun" ] || [ ! -s "$newFile" ] || [ "$xmlFile" -nt "$newFile" ]; then
            echo processing $xmlFile
            node node-parse-MFP-file.js ../EDGAR-a-CIK/CIK/CIK-map.json <"$xmlFile" # | jq . >"$newFile"
        fi
    done
exit 0
