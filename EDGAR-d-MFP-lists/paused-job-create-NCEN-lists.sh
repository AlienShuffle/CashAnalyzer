#!/usr/bin/bash
#
# This processes the list of EDGAR submissions files and pulls out a list of
# N-CEN reports eligible for processing.
#
# process the command argument list.
pubDelayHours=144
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

# create data source file paths (move to meta.common.sh once this is fully implemented.)
NCENlistsDir="../EDGAR-d-MFP-lists/NCEN-lists"
[ -d "$NCENlistsDir" ] || mkdir -p "$NCENlistsDir"

find $submissionsFilesDir -type f -print |
    while read -r submissionFile; do
        newFile="$NCENlistsDir/$(basename $submissionFile)"
        if [ -n "$forceRun" ] || [ ! -s "$newFile" ] || [ "$submissionFile" -nt "$newFile" ]; then
            echo processing $submissionFile
            node node-parse-submission-file.js 'N-CEN' <"$submissionFile" | jq . >"$newFile"
        fi
    done
exit 0