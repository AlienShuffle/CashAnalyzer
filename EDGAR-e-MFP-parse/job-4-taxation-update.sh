#!/usr/bin/bash
#
# This processes the list of EDGAR submissions files and pulls out a list of
# MFP reports eligible for processing.
#
# process the command argument list.
pubDelayHours=24
runDelayHours=12
accountClass=EDGAR
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

if [ ! -s "$fundsMetaFile" ]; then
    echo "$fundsMetaFile does not exist, exiting..."
    exit 1
fi
if [ -z "$fundsList" ] || [ ! -s "$fundsList" ]; then
    echo "$fundsList does not exist, exiting..."
    exit 1
fi
[ -d tickers ] || mkdir -p tickers
[ -d tax ] || mkdir -p tax

cat $fundsList |
    while read -r ticker; do
        tickerFile="tickers/$ticker.json"
        taxFile="tax/$ticker-taxation.json"

        # continue if file exists, no new files, and force not specified.
        [ -s "$taxFile" ] &&
            [ "$taxFile" -nt "$tickerFile" ] &&
            [ ! -n "$forceRun" ] &&
            continue

        #echo "updating $ticker..."
        node ./node-taxation-calc.js <"$tickerFile" |
            jq . >"$taxFile"

        tickerDir="$cloudFlareHome/$accountClass/$ticker/"
        [ -d "$tickerDir" ] || mkdir -p "$tickerDir"

        jsonFlare="$cloudFlareHome/$accountClass/$ticker/$ticker-taxation.json"
        csvFlare="$cloudFlareHome/$accountClass/$ticker/$ticker-taxation.csv"
        if ../bin/jsonDifferent.sh "$taxFile" "$jsonFlare"; then
            cat "$taxFile" >"$jsonFlare"
            echo "published updated $ticker taxation cloudFlare history file."
            # put csv export here.
            ./exportTaxationcsv.sh "$jsonFlare" >"$csvFlare"
            #echo "published updated cloudflare csv file."
        fi
    done
rm -f tmp.json
exit 0
