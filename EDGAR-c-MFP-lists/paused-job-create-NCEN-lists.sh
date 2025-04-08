#!/usr/bin/bash
#
# This processes the list of EDGAR submissions files and pulls out a list of
# N-CEN reports eligible for processing.
#
# process the command argument list.
pubDelayHours=48
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

# create data source file paths.
submissionsFiles="../EDGAR-b-submissions/submissions"
NCENlists="NCEN-lists"

[ -d "$NCENlists" ] || mkdir -p "$NCENlists"

find $submissionsFiles -type f -print |
    while read -r submissionFile; do
        newFile="$NCENlists/$(basename $submissionFile)"
        if [ -n "$forceRun" ] || [ ! -s "$newFile" ] || [ "$submissionFile" -nt "$newFile" ]; then
            echo processing $submissionFile
            node node-parse-submission-file.js 'N-CEN' <"$submissionFile" | jq . >"$newFile"
        fi
    done
exit 0
