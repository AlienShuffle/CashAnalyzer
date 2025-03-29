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
MFPlists="MFP-lists"
MFPfiles="MFP-files"
[ -d "$MFPlists" ] || mkdir -p "$MFPlists"
[ -d "$MFPfiles" ] || mkdir -p "$MFPfiles"

getCount=0
listCount=0
for list in $MFPlists/*.json; do
    #echo "Processing $list"
    cat "$list" | jq -r '.[] | [.cik,.accessionNumber,.url,.filingDate] | @csv' | sed -e 's/"//g' |
        while read -r entry; do
            cik=$(echo $entry | cut -d, -f1)
            accessionNumber=$(echo $entry | cut -d, -f2)
            url=$(echo $entry | cut -d, -f3)
            filingDate=$(echo $entry | cut -d, -f4)
            #echo "filingDate=$filingDate"
            targetDir="$MFPfiles/$cik"
            [ -d "$targetDir" ] || mkdir -p "$targetDir"
            targetFile="$targetDir/$filingDate-$accessionNumber.xml"
            if [ ! -s "$targetFile" ]; then
                echo "download $cik : $accessionNumber"
                ../bin/getEDGAR.sh "$url" >"$targetFile"
                sleep 1
                if grep '<title>SEC.gov | File Unavailable</title>' $targetFile; then
                    echo "failed download: $targetFile"
                    rm $targetFile
                fi
                getCount=$(($getCount + 1))
            #else
            #    echo "already downloaded: $cik/$filingDate-$accessionNumber"
            fi
            [ $getCount -gt 15 ] && exit 1
        done
    listCount=$(($listCount + 1))
    [ $listCount -gt 20 ] && exit 1
done
exit 0
