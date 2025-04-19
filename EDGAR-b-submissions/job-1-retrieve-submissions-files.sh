#!/usr/bin/bash
#
# This script creates a list of submissions pages to download from EDGAR.
# this is just the list of URLs to do the work.
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
submissionsCIKs="submissionsCIKs.txt"

source ../bin/skipWeekends.sh

# run extra during MFP reporting week.
dayOfMonth=$(date +'%d')
if [ $dayOfMonth -gt 4 ] && [ $dayOfMonth -lt 11 ]; then
    runDelayHours=4
fi

pubDelayFile=""
runDelayFile="$submissionsCIKs"
source ../bin/testDelays.sh

node ./node-create-submissions-CIKs.js <"$companyMap" | sort -u >$submissionsCIKs
cat $submissionsCIKs |
    while IFS= read -r cik; do
        echo retrieving $cik
        ../bin/getEDGAR.sh "https://data.sec.gov/submissions/CIK$cik.json" | jq . >submissions/$cik.json
        sleep 2
    done
# do not remove this $submissionsCIKs, it is the run delay test variable!
