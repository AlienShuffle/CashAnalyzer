#!/usr/bin/bash
#
# This processes the list of EDGAR submissions files and pulls out a list of
# MFP reports eligible for processing.
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
        echo "$(basename $0): Parameter $1 ignored"
        shift
        ;;
    esac
    shift
done
# computer-specific configurations.
source ../meta.common.sh
source ../bin/nodeJobUtils.sh

find $submissionsFilesDir -type f -print |
    while read -r submissionFile; do
        newFile="$MFPListsDir/$(basename $submissionFile)"
        if [ -n "$forceRun" ] || [ ! -s "$newFile" ] || [ "$submissionFile" -nt "$newFile" ]; then
            echo processing $submissionFile # "=>" $newFile
            runNode "$newFile" "$submissionFile" node-parse-submission-file.js ||
                echo "node-parse-submission-file failed (status ${statuses[*]}) for $submissionFile"
        fi
    done

find $submissionsExtensionsDir -type f -print |
    while read -r submissionFile; do
        newFile="$MFPListsDir/$(basename $submissionFile)"
        cik=$(basename $submissionFile | sed -e 's/^CIK//' | sed -e 's/-submissions-....json//')
        #echo $cik
        if [ -n "$forceRun" ] || [ ! -s "$newFile" ] || [ "$submissionFile" -nt "$newFile" ]; then
            echo processing $submissionFile
            runNode "$newFile" "$submissionFile" node-parse-submission-extension.js "$cik" ||
                echo "node-parse-submission-extension failed (status ${statuses[*]}) for $submissionFile"
        fi
    done
exit 0
