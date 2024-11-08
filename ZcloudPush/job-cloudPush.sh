#!/usr/bin/bash
# process the command argument list.
pubDelayHours=2
runDelayHours=1
bankName="ZcloudPush"
while [ -n "$1" ]; do
    case $1 in
    "-b")
        bankName="$2"
        #echo "bankname=$bankName"
        shift
        ;;
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "-stdin")
        stdInFile="$2"
        #echo "stdInFile=$stdInFile"
        ;;
    "-nodearg")
        nodeArg="$2"
        #echo "nodeArg=$nodeArg"
        shift
        ;;
    "-pubdelay")
        pubDelayHours="$2"
        #echo "pubDelayHours=$pubDelayHours"
        shift
        ;;
    "-rundelay")
        runDelayHours="$2"
        #echo "runDelayHours=$runDelayHours"
        shift
        ;;
    esac
    shift
done
if [ -z "$bankName" ]; then
    echo "$0: -b bankName missing, need to specify a valid bank."
    exit 1
fi
if [ ! -d "$HOME/CashAnalyzer/$bankName" ]; then
    echo "$0: $bankName is not a valid bank name."
    exit 1
fi
# look for a -f to force run, overriding the time delays.

source ../meta.$(hostname).sh

git pull
#rsync -avu --delete "$publishHome/" "$cloudFlareHome"
# currently not deleting files on the transfer as I am going to use
# hugo to build a bit of a site around this content.
rsync -avu "$publishHome/" "$cloudFlareHome"
cd "$cloudFlareHome"
echo 'running tree'
../tree.sh
echo 'running git commmands'
git status
git add *
git commit -m "job-control $(date)" *
git push
echo pwd=$(pwd)