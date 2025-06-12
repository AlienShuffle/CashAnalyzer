#!/usr/bin/bash
#
# script pulss the list of funds being tracked across all the different queries into a single
# list of fund tickers. This is used by this query to get a full list of funds from moneymarket.fun.
# it is also used by the EDGAR tools to define a list of tickers to track EDGAR reports for too.
#
# storeHistory-funds.csv is a local list curated from the old Google App Script fund list.
# it is merged with the funds listed for yieldFinder, Vanguard, and Fidelity too.
#
# process the command argument list.
pubDelayHours=0
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

pubDelayFile=""
runDelayFile="$fundsList"
source ../bin/testDelays.sh

if [ -s "$fundsList" ]; then
    newCount=$(find .. -name '*-funds.csv' -newer $fundsList -print | wc -l)
    if [ "$newCount" -eq "0" ]; then
        echo "$fundsList sources not updated since last run."
        [ -z "$forceRun" ] && exit 0
    fi
fi

find .. -name '*-funds.csv' -exec cat {} \; |
    cut -d, -f1 |
    sort -u >$fundsList
