#!/usr/bin/bash
# process the command argument list.
pubDelayHours=2
runDelayHours=1
bankName="zcloudPush"
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

source ../meta.common.sh

if [ ! -d "$cloudFlareHome/../.git" ]; then
    echo "$0: we are running on a non-git cloudflare tree, skipping sync process."
    exit 1
fi

echo "cd $dir"
cd "$dir"
echo "git pull"
git pull
echo "cd $cloudFlareHome"
cd "$cloudFlareHome"
echo "../tree.sh"
../tree.sh
echo git status
git status
echo "git add" *
git add *
echo "git commit -m \"job-control $(date)\"" *
git commit -m "job-control $(date)" *
echo "git push"
git push