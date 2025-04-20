#!/usr/bin/bash
#
# This processes the list of EDGAR MFP submitted files and runs through the
# storage folder, looking to see if the file is already downloaded, if not, it
# downloads the new files.
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
    "--missingReport")
        missingReport=true
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

getCount=0
listCount=0
for list in $MFPListsDir/*.json; do
    #echo "Processing $list"
    # this next line is moved to end to not create a sub-shell via piping.
    #cat "$list" | jq -r '.[] | [.cik,.accessionNumber,.url,.filingDate] | @csv' | sed -e 's/"//g' |
    while read -r entry; do
        cik=$(echo $entry | cut -d, -f1)
        accessionNumber=$(echo $entry | cut -d, -f2)
        url=$(echo $entry | cut -d, -f3)
        filingDate=$(echo $entry | cut -d, -f4)
        #echo "filingDate=$filingDate"
        targetDir="$MFPFilesDir/$cik"
        [ -d "$targetDir" ] || mkdir -p "$targetDir"
        targetFile="$targetDir/$filingDate-$accessionNumber.xml"
        if [ ! -s "$targetFile" ]; then
            echo "$getCount: download $cik : $accessionNumber"
            if [ -z "$missingReport" ]; then
                ../bin/getEDGAR.sh "$url" >"$targetFile"
                sleep 1
                if grep '<title>SEC.gov | File Unavailable</title>' $targetFile; then
                    echo "failed download: $targetFile"
                    rm $targetFile
                fi
            fi
            getCount=$(($getCount + 1))
        fi
        [ -z "$missingReport" ] && [ $getCount -gt 19 ] && exit 1
    done < <(cat "$list" | jq -r '.[] | [.cik,.accessionNumber,.url,.filingDate] | @csv' | sed -e 's/"//g')
    listCount=$(($listCount + 1))
done
[ ! -z "$missingReport" ] && echo "$listCount CIKs, $getCount files to be downloaded."
exit 0
