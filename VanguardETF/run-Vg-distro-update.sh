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
jsonNew="history/$ticker-distro-new.json"
jsonFlare="$cloudFlareHome/ETFs/$ticker/$ticker-distros.json"
jsonUnique="history/$ticker-distro-new-unique.json"
[ -d history ] || mkdir -p history

#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update these delayHours as appropriate for the data source.
pubDelaySeconds=$(($pubDelayHours * 60 * 60))
if [ -f "$jsonFlare" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonFlare")))" -lt "$pubDelaySeconds" ]; then
  echo "Published file is not yet $pubDelayHours hours old - $(stat -c '%y' "$jsonFlare" | cut -d: -f1,2)"
  [ -z "$forceRun" ] && exit 0
fi
runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ -f "$jsonNew" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonNew")))" -lt "$runDelaySeconds" ]; then
  echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$jsonNew" | cut -d: -f1,2)"
  [ -z "$forceRun" ] && exit 0
fi
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
rm -f "$curlFile"
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
exit 0
