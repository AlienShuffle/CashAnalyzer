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

# create data source file paths.
submissionsCIKs="submissionsCIKs.txt"

# run more often during the reporting period of the month.
dayOfMonth=$(date +'%d')
[ $dayOfMonth -gt 3 ] && [ $dayOfMonth -lt 10 ] && runDelayHours=4

runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ -s "$submissionsCIKs" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$submissionsCIKs")))" -lt "$runDelaySeconds" ]; then
    echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$submissionsCIKs" | cut -d: -f1,2)"
    [ -z "$forceRun" ] && exit 0
fi

node ./node-create-submissions-CIKs.js <"$companyMap" | sort -u >$submissionsCIKs
cat $submissionsCIKs |
    while IFS= read -r cik; do
        echo retrieving $cik
        ../bin/getEDGAR.sh "https://data.sec.gov/submissions/CIK$cik.json" | jq . >submissions/$cik.json
        sleep 2
    done
