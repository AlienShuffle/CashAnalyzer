#!/usr/bin/bash

# process the command argument list.
pubDelayHours=168
runDelayHours=24
while [ -n "$1" ]; do
    case $1 in
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "--nightDelayHour")
        nightDelayHour="$2"
        #echo "nightDelayHour=$nightDelayHour"
        shift
        ;;
    "--pubDelay")
        pubDelayHours="$2"
        #echo "pubDelayHours=$pubDelayHours"
        shift
        ;;

    "-q" | "--quiet")
        quiet="true"
        #echo "quiet=true"
        ;;
    "--runDelay")
        runDelayHours="$2"
        #echo "runDelayHours=$runDelayHours"
        shift
        ;;
    "--runWeekends")
        runWeekends="true"
        #echo "runWeekends=$runWeekends"
        ;;
    *)
        echo "$(basename $0): Parameter $1 ignored"
        shift
        ;;
    esac
    shift
done
source ../meta.common.sh
pubDelayFile="3-lot-taxes.json"
runDelayFile="1-lot-list.json"
pubDelayWaitFullDays="true"
source ../bin/testDelays.sh

for script in $(ls ./run-?-*.sh); do
    echo ------------
    echo "Running $script @ $(date)"
    dir=$(dirname $script)
    scriptFile=$(basename $script)
    {
        cd $dir
        eval ./$scriptFile "$@"
        #echo "Finished $scriptFile @ $(date) return code $?"
        [ $? -ne 0 ] && echo "Error processing $scriptFile" 1>&2 && exit 1
    }
    echo
done
