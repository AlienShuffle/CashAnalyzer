source ../meta.$(hostname).sh
# current rate files
jsonRateNew=Ally-rate-new.json
jsonRatePub="$publishHome/Banks/Ally/Ally-rate.json"
#echo jsonRateNew=$jsonRateNew
#echo jsonRatePub=$jsonRatePub
# yield history files
jsonHistoryUnique="Ally-history-unique.json"
jsonHistoryPub="$publishHome/Banks/Ally/Ally-history.json"
#echo jsonHistoryUnique=$jsonHistoryUnique
#echo jsonHistoryPub=$jsonHistoryPub
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update the delayHours values as appropriate for the data source.
updateDelayHours=20
updateDelaySeconds=$(($updateDelayHours * 60 * 60))
if [ -f "$jsonRatePub" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonRatePub")))" -lt "$updateDelaySeconds" ]; then
  echo "Published file is not yet $updateDelayHours hours old - $(stat -c '%y' "$jsonRatePub"| cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
runDelayHours=6
runDelaySeconds=$(($runDelayHours * 60 * 60))
if  [ -f "$jsonRateNew" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonRateNew")))" -lt "$runDelaySeconds" ]; then
  echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$jsonRateNew" | cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
node ./node-Ally-update.js | jq . >"$jsonRateNew"
if [ ! $? ]; then
  echo "Ally rate retrieval failed, exiting."
  exit 1
fi
if [ ! -s "$jsonRateNew" ]; then
  echo "Empty Ally rate file."
  exit 1
fi
apyNew=$(grep apy "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$apyNew" ] || [ "$apyNew" = "null" ]; then
  echo "New Ally rate file has empty APY."
  exit 1
fi
#
# Process the daily yield results in Rate and merge with history.
#
if [ -f "$jsonHistoryPub" ]; then
jq -s 'flatten | unique_by([.accountType,.asOfDate])' "$jsonRateNew" "$jsonHistoryPub" >"$jsonHistoryUnique"
else
  cat "$jsonRateNew" >"$jsonHistoryUnique"
fi
lenHistoryUnique=$(grep -o apy "$jsonHistoryUnique" | wc -l)
if [ -s "$jsonHistoryPub" ]; then
  lenHistoryPub=$(grep -o apy "$jsonHistoryPub" | wc -l)
else
  lenHistoryPub=0
  echo "Ally history history file has not been published."
  dir=$(dirname "$jsonHistoryPub")
  [ -d "$dir" ] || mkdir "$dir"
fi
echo "entries new($lenHistoryUnique) :: pub($lenHistoryPub)"
if [ $lenHistoryUnique -gt $lenHistoryPub ]; then
  cat "$jsonHistoryUnique" >"$jsonHistoryPub"
  echo "published updated Ally history history file."
fi
#
# process the rate file.
#
dateNew=$(grep asOfDate "$jsonRateNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
  echo "New Ally rate file does not include dates."
  exit 1
fi
echo dateNew=$dateNew

if [ -s "$jsonRatePub" ]; then
  datePub=$(grep asOfDate "$jsonRatePub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
  datePub=""
  echo "Ally rate file has not been published."
  dir=$(dirname "$jsonRatePub")
  [ -d "$dir" ] || mkdir "$dir"
fi
echo datePub=$datePub
if [[ $datePub < $dateNew ]]; then
  cat "$jsonRateNew" >"$jsonRatePub"
  echo "published updated Ally rate file."
fi
exit 0
