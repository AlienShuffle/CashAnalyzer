#!/usr/bin/bash
#
# This processes the list of EDGAR submissions files and pulls out a list of
# MFP reports eligible for processing.
#
# process the command argument list.
pubDelayHours=12
runDelayHours=2
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
if [ ! -s "$companyMap" ]; then
    echo "$companyMap does not exist, exiting..."
    exit 1
fi
fiscalYears="../EDGAR-b-submissions/fiscalYearFile.csv"
if [ ! -s "$fiscalYears" ]; then
    echo "$fiscalYears does not exist, exiting..."
    exit 1
fi
monthlyReport="reports"
yieldReports="yields"

find $MFPFilesDir -type f -name '*.xml' -print |
    while read -r xmlFile; do
        accession=$(dirname $xmlFile | sed -e 's/^.*\///')
        cikDir="$monthlyReport/$accession"
        [ -d "$cikDir" ] || mkdir -p "$cikDir"
        #echo looking at $xmlFile
        newFile="$cikDir/$(basename $xmlFile | sed -e 's/\.xml/\.json/')"
        filingDate=$(basename $xmlFile | cut -d- -f1-3)
        #echo "filingDate=$filingDate"
        if [ -n "$forceRun" ] || [ ! -s "$newFile" ] || [ "$xmlFile" -nt "$newFile" ]; then
            echo processing $xmlFile
            node node-parse-MFP-file.js "$companyMap" "$fiscalYears" "$filingDate" <"$xmlFile" | jq . >"$newFile"
        fi
        yieldDir="$yieldReports/$accession"
        [ -d "$yieldDir" ] || mkdir -p "$yieldDir"
        yieldFile="$yieldDir/$(basename $xmlFile | sed -e 's/\.xml/\.json/')"
        if [ -n "$forceRun" ] || [ ! -s "$yieldFile" ] || [ "$xmlFile" -nt "$yieldFile" ]; then
            echo processing yield for $xmlFile
            node node-parse-MFP-yield.js "$companyMap" <"$xmlFile" | jq . >"$yieldFile"
            ../bin/MM-update-common-job.sh --injectProcessedJson $yieldFile
        fi
    done
exit 0
