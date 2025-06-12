#!/usr/bin/bash
#
# This script creates a list of submissions pages to download from EDGAR.
# this is just the list of fileNames to do the work.
#
# process the command argument list.
pubDelayHours=0
runDelayHours=144
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
submissionExtensionFiles="submissionExtensionFile.json"
[ -d submissions-ext ] || mkdir -p submissions-ext

# run more often during the reporting period of the month.
#dayOfMonth=$(date +'%d')
#[ $dayOfMonth -gt 3 ] && [ $dayOfMonth -lt 10 ] && runDelayHours=4

pubDelayFile=""
runDelayFile="$submissionExtensionFiles"
source ../bin/testDelays.sh

for file in submissions/*.json; do
    node node-find-submission-extensions.js <$file
done | jq -s 'flatten | .' >$submissionExtensionFiles

cat $submissionExtensionFiles |
    jq -r '.[] | .fileName' |
    while IFS= read -r fileName; do
        echo retrieving $fileName
        ../bin/getEDGAR.sh "https://data.sec.gov/submissions/$fileName" | jq . >"submissions-ext/$fileName"
        sleep 1
    done
# do not remove this $submissionExtensionFiles, it is the run delay test variable!
