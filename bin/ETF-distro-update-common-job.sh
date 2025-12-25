# process the command argument list.
pubDelayHours=18
runDelayHours=4
while [ -n "$1" ]; do
  case $1 in
  "-f")
    forceRun=true
    dashF='-f'
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
  "-q" | "--quiet")
    quiet="true"
    #echo "quiet=true"
    ;;
  "--runDelay")
    runDelayHours="$2"
    #echo "runDelayHours=$runDelayHours"
    shift
    ;;
  "--ticker")
    ticker="$2"
    #echo "ticker=$ticker"
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
  echo "missing ETF name. --ticker argument is required."
  exit 1
fi
source ../meta.$(hostname).sh

jsonNew="history/$ticker/$ticker-distro-new.json"
jsonFlare="$cloudFlareHome/Funds/$ticker/$ticker-distros.json"
csvFlare="$cloudFlareHome/Funds/$ticker/$ticker-distros.csv"
jsonUnique="history/$ticker/$ticker-distro-new-unique.json"
[ -d "history/$ticker" ] || mkdir -p "history/$ticker"

source ../bin/skipWeekends.sh
pubDelayFile="$jsonFlare"
runDelayFile="$jsonNew"
source ../bin/testDelays.sh

#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
#echo "Starting node retrieval app."
if [ "$collectionScript" ]; then
  if [ ! -x "$collectionScript" ]; then
    echo "invalid collectionScript $collectionScript, exiting..."
    exit 1
  fi
else
  collectionScript="./collectionScript-distro.sh"
  if [ ! -x "$collectionScript" ]; then
    echo "missing collectionScript $collectionScript, exiting..."
    exit 1
  fi
fi
#echo "running $collectionScript"
if [ -n "$collectionArg" ]; then
  $collectionScript "$collectionArg" >"$jsonNew"
else
  $collectionScript >"$jsonNew"
fi
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
  (
    echo 'recordDate,exDividendDate,payableDate,totalDistribution,ordinaryIncome,stcg,ltcg,returnOfCapital'
    jq -r '.[] | [.recordDate,.exDividendDate,.payableDate,.totalDistribution,.ordinaryIncome,.stcg,.ltcg,.returnOfCapital] | @csv' "$jsonUnique"
  ) >"$csvFlare"
fi
