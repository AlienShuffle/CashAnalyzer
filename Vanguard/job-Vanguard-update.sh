source ../meta.$(hostname).sh
# current rate files
jsonRateNew=Vanguard-rate-new.json
jsonRatePub="$publishHome/Banks/Vanguard/Vanguard-rate.json"
#echo jsonRateNew=$jsonRateNew
#echo jsonRatePub=$jsonRatePub
# history history files
jsonHistorysUnique="Vanguard-history-unique.json"
jsonHistorysPub="$publishHome/Banks/Vanguard/Vanguard-history.json"
#echo jsonHistorysUnique=$jsonHistorysUnique
#echo jsonHistorysPub=$jsonHistorysPub
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update the delayHours values as appropriate for the data source.
updateDelayHours=20
updateDelaySeconds=$(($updateDelayHours * 60 * 60))
if [ -f "$jsonRatePub" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonRatePub")))" -lt "$updateDelaySeconds" ]; then
  echo "Published file is not yet $updateDelayHours hours old - $(stat -c '%y' "$jsonRatePub" | cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
runDelayHours=6
runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ -f "$jsonRateNew" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonRateNew")))" -lt "$runDelaySeconds" ]; then
  echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$jsonRateNew" | cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
node ./node-Vanguard-update.js | jq . >"$jsonRateNew"
if [ ! $? ]; then
  echo "Vanguard rate retrieval failed, exiting."
  exit 1
fi
if [ ! -s "$jsonRateNew" ]; then
  echo "Empty Vanguard rate file."
  exit 1
fi
apyNew=$(grep apy "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$apyNew" ] || [ "$apyNew" = "null"]; then
  echo "New Vanguard rate file has empty APY."
  exit 1
fi
#
# Process the daily history results in rate and merge with history.
#
if [ -f "$jsonHistorysPub" ]; then
  jq -s 'flatten | unique_by([.accountType,.asOfDate])' "$jsonRateNew" "$jsonHistorysPub" >"$jsonHistorysUnique"
else
  cat "$jsonRateNew" >"$jsonHistorysUnique"
fi
lenHistorysUnique=$(grep -o apy "$jsonHistorysUnique" | wc -l)
if [ -s "$jsonHistorysPub" ]; then
  lenHistorysPub=$(grep -o apy "$jsonHistorysPub" | wc -l)
else
  lenHistorysPub=0
  echo "Vanguard history history file has not been published."
  dir=$(dirname "$jsonHistorysPub")
  [ -d "$dir" ] || mkdir "$dir"
fi
echo "entries new($lenHistorysUnique) :: pub($lenHistorysPub)"
if [ $lenHistorysUnique -gt $lenHistorysPub ]; then
  cat "$jsonHistorysUnique" >"$jsonHistorysPub"
  echo "published updated Vanguard history history file."
fi
#
# process the rate file.
#
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
  echo "New Vanguard rate file does not include dates."
  exit 1
fi
echo dateNew=$dateNew

if [ -s "$jsonRatePub" ]; then
  datePub=$(grep asOfDate "$jsonRatePub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
  datePub=""
  echo "Vanguard rate file has not been published."
  dir=$(dirname "$jsonRatePub")
  [ -d "$dir" ] || mkdir "$dir"
fi
echo datePub=$datePub
if [[ $datePub < $dateNew ]]; then
  cat "$jsonRateNew" >"$jsonRatePub"
  echo "published updated Vanguard rate file."
fi
exit 0
