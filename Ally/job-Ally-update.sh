source ../meta.$(hostname).sh
# current facts files
jsonFactsNew=Ally-facts-new.json
jsonFactsPub="$publishHome/Banks/Ally/Ally-facts.json"
#echo jsonFactsNew=$jsonFactsNew
#echo jsonFactsPub=$jsonFactsPub
# yield history files
jsonYieldsUnique="Ally-yields-unique.json"
jsonYieldsPub="$publishHome/Banks/Ally/Ally-yields.json"
#echo jsonYieldsUnique=$jsonYieldsUnique
#echo jsonYieldsPub=$jsonYieldsPub
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update the delayHours values as appropriate for the data source.
updateDelayHours=20
updateDelaySeconds=$(($updateDelayHours * 60 * 60))
if [ -f "$jsonFactsPub" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonFactsPub")))" -lt "$updateDelaySeconds" ]; then
  echo "Published file is not yet $updateDelayHours hours old - $(stat -c '%y' "$jsonFactsPub"| cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
runDelayHours=6
runDelaySeconds=$(($runDelayHours * 60 * 60))
if  [ -f "$jsonFactsNew" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonFactsNew")))" -lt "$runDelaySeconds" ]; then
  echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$jsonFactsNew" | cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
node ./node-Ally-update.js | jq . >"$jsonFactsNew"
if [ ! $? ]; then
  echo "Ally facts retrieval failed, exiting."
  exit 1
fi
if [ ! -s "$jsonFactsNew" ]; then
  echo "Empty Ally facts file."
  exit 1
fi
#
# Process the daily yield results in Facts and merge with history.
#
if [ -f "$jsonYieldsPub" ]; then
jq -s 'flatten | unique_by([.accountType,.asOfDate])' "$jsonFactsNew" "$jsonYieldsPub" >"$jsonYieldsUnique"
else
  cat "$jsonFactsNew" >"$jsonYieldsUnique"
fi
lenYieldsUnique=$(grep -o apy "$jsonYieldsUnique" | wc -l)
if [ -s "$jsonYieldsPub" ]; then
  lenYieldsPub=$(grep -o apy "$jsonYieldsPub" | wc -l)
else
  lenYieldsPub=0
  echo "Ally yields history file has not been published."
  dir=$(dirname "$jsonYieldsPub")
  [ -d "$dir" ] || mkdir "$dir"
fi
echo "entries new($lenYieldsUnique) :: pub($lenYieldsPub)"
if [ $lenYieldsUnique -gt $lenYieldsPub ]; then
  cat "$jsonYieldsUnique" >"$jsonYieldsPub"
  echo "published updated Ally yields history file."
fi
#
# process the facts file.
#
dateNew=$(grep asOfDate "$jsonFactsNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
  echo "New Ally facts file does not include dates."
  exit 1
fi
echo dateNew=$dateNew

if [ -s "$jsonFactsPub" ]; then
  datePub=$(grep asOfDate "$jsonFactsPub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
  datePub=""
  echo "Ally facts file has not been published."
  dir=$(dirname "$jsonFactsPub")
  [ -d "$dir" ] || mkdir "$dir"
fi
echo datePub=$datePub
if [[ $datePub < $dateNew ]]; then
  cat "$jsonFactsNew" >"$jsonFactsPub"
  echo "published updated Ally facts file."
fi
exit 0
