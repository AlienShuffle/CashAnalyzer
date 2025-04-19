# process the command argument list.
pubDelayHours=18
runDelayHours=4
while [ -n "$1" ]; do
  case $1 in
  "--ticker")
    ticker="$2"
    #echo "ticker=$ticker"
    shift
    ;;
  "-f")
    forceRun=true
    #echo "forceRun=$forceRun"
    ;;
  "--nodearg")
    nodeArg="$2"
    #echo "nodeArg=$nodeArg"
    shift
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
if [ -z "$ticker" ]; then
  echo "missing ETF name"
  exit 1
fi

source ../meta.$(hostname).sh
source ../bin/skipWeekends.sh

jsonNew="history/$ticker-distro-new.json"
jsonFlare="$cloudFlareHome/Funds/$ticker/$ticker-distros.json"
jsonUnique="history/$ticker-distro-new-unique.json"
[ -d history ] || mkdir -p history

pubDelayFile="$jsonFlare"
runDelayFile="$jsonNew"
source ../bin/testDelays.sh

#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
#echo "Starting node retrieval app."
curlFile="$ticker-file.json"
curl -sSL -o- --referer https://investor.vanguard.com \
  https://investor.vanguard.com/investment-products/etfs/profile/api/$ticker/distribution >"$curlFile"
node ./node-Vg-distro-update.js <"$curlFile" | jq . >"$jsonNew"
if [ ! $? ]; then
  echo "$ticker distro retrieval failed, exiting."
  exit 1
fi
if [ ! -s "$jsonNew" ]; then
  echo "Empty new $ticker distro file."
  exit 1
fi

# this should merge the old and new, removing duplicates and keeping newest.
if [ -s "$jsonFlare" ]; then
  jq -s 'flatten | unique_by(.exDividendDate) | reverse' "$jsonNew" "$jsonFlare" >"$jsonUnique"
else
  cat "$jsonNew" >"$jsonUnique"
fi
# publish cloudFlare files.
dir=$(dirname "$jsonFlare")
[ -d "$dir" ] || mkdir -p "$dir"
if ../bin/jsonDifferent.sh "$jsonUnique" "$jsonFlare"; then
  cat "$jsonUnique" >"$jsonFlare"
  echo "published updated cloudFlare $ticker distro history file."
fi
#
# Turn current SEC Yield data into a rates history similar to MM funds, but in the Funds folder.
#
cat "$curlFile" |
  ../bin/MM-update-common-job.sh \
    --accountClass Funds \
    --nodeArg "$ticker" \
    --processScript ./node-Vg-yield-update.js \
    --pubDelay $pubDelayHours --runDelay $runDelayHours "$@"
rm -f "$curlFile"
exit 0
