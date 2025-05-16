#!/usr/bin/bash
#
# Create a mappings of tickers to EDGAR CIK keys, used to look up more details about each fund.
# This script takes each fund ticker, looks it up in the EDGAR company_tickers_mf.json file
# and creates a JSON object that collects all the key data in on place.
#
# the current funds list is updated by a script in the mmFunCurr directory.
#
# process the command argument list.
pubDelayHours=0     # turns off pubDelay testing.
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

dir=$(dirname "$companyMap")
#echo $companyMap = $dir
[ -d "$dir" ] || mkdir "$dir"

pubDelayFile=""
runDelayFile="$companyMap"
source ../bin/testDelays.sh
if [ -s "$companyMap" ] && [ "$(($(stat -c "%Y" "$fundsList") - $(stat -c "%Y" "$companyMap")))" -lt "0" ]; then
    echo "$fundsList not updated since last run."
    [ -z "$forceRun" ] && exit 0
fi
tmpFile=investment-map.xml
../bin/getEDGAR.sh "https://www.sec.gov/files/investment/data/other/investment-company-series-and-class-information/investment-company-series-class-2024.xml" >"$tmpFile"
node ./node-company-map-update.js "$fundsList" "company-map-manual-entries.json" <"$tmpFile" | jq . >"$companyMap"
echo updated $companyMap
rm -f "$tmpFile"
