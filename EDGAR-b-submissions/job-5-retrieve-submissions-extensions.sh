#!/usr/bin/bash
#
# This script creates a list of submissions pages to download from EDGAR.
# this is just the list of fileNames to do the work.
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

# create data source file paths.
submissionExtensionFiles="submissionExtensionFile.json"
[ -d submissions-ext ] || mkdir -p submissions-ext

# run more often during the reporting period of the month.
#dayOfMonth=$(date +'%d')
#[ $dayOfMonth -gt 3 ] && [ $dayOfMonth -lt 10 ] && runDelayHours=4

runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ -s "$submissionExtensionFiles" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$submissionExtensionFiles")))" -lt "$runDelaySeconds" ]; then
    echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$submissionExtensionFiles" | cut -d: -f1,2)"
    [ -z "$forceRun" ] && exit 0
fi

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
