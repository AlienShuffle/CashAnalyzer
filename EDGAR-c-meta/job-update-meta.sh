#!/usr/bin/bash
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

if [ ! -s "$fundsMetaFile" ] ||
    [ "$fundsMetaFile" -ot "$companyMap" ] ||
    [ "$fundsMetaFile" -ot "$fiscalYearFile" ]; then
    echo source files updated, running script...
else
    pubDelayFile=""
    runDelayFile="$fundsMetaFile"
    source ../bin/testDelays.sh
fi
../mmFunCurr/mmFunCurrCollectionScript.sh | node ./node-mmFunCurr-metaData.js "$companyMap" "$fiscalYearFile" | jq . >"$fundsMetaFile"
