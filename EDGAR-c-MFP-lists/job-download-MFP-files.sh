#!/usr/bin/bash
#
# This processes the list of EDGAR MFP submitted files and runs through the
# storage folder, looking to see if the file is already downloaded, if not, it
# downloads the new files.
#
# process the command argument list.
pubDelayHours=48
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

# create data source file paths.
submissionsFiles="../EDGAR-b-submissions/submissions"
MFPlists="MFP-lists"
MFPfiles="MFP-files"
[ -d "$MFPlists" ] || mkdir -p "$MFPlists"
[ -d "$MFPfiles" ] || mkdir -p "$MFPfiles"

for list in $MFPlists/*.json; do
    #echo "processing $list"
    cat "$list" | jq -r '.[] | [.cik,.accessionNumber,.url] | @csv' | sed -e 's/"//g' |
        while read -r entry; do
            cik=$(echo $entry | cut -d, -f1)
            accessionNumber=$(echo $entry | cut -d, -f2)
            url=$(echo $entry | cut -d, -f3)
            #echo $cik ":" $accessionNumber ":" $url
            targetDir="$MFPfiles/$cik"
            [ -d "$targetDir" ] || mkdir -p "$targetDir"
            targetFile="$targetDir/$accessionNumber.xml"
            if [ ! -s "$targetFile" ]; then
                echo "download $cik : $accessionNumber"
                ../bin/getEDGAR.sh "$url" >"$targetFile"
            fi
            exit 1
        done
    exit 1
done
exit 1

find $submissionsFiles -type f -print |
    while read -r submissionFile; do
        newFile="$MFPlists/$(basename $submissionFile)"
        if [ -n "$forceRun" ] || [ ! -s "$newFile" ] || [ "$submissionFile" -nt "$newFile" ]; then
            echo processing $submissionFile
            node node-parse-submission-file.js <"$submissionFile" | jq . >"$newFile"
        fi
    done
exit 0
