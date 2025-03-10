source ../meta.$(hostname).sh
jsonNew=USFR-facts-new-v98.json
jsonFlare="$cloudFlareHome/ETFs/USFR/USFR-facts.json"
#echo jsonNew=$jsonNew
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update these delayHours as appropriate for the data source.
updateDelayHours=18
updateDelaySeconds=$(($updateDelayHours * 60 * 60))
if [ -f "$jsonFlare" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonFlare")))" -lt "$updateDelaySeconds" ]; then
  echo "Published file is not yet $updateDelayHours hours old - $(stat -c '%y' "$jsonFlare" | cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
runDelayHours=4
runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ -f "$jsonNew" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonNew")))" -lt "$runDelaySeconds" ]; then
  echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$jsonNew" | cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
node ./node-USFR-facts-json-v98.js | jq . >"$jsonNew"
if [ ! $? ]; then
  echo "USFR facts retrieval failed, exiting."
  exit 1
fi
if [ ! -s "$jsonNew" ]; then
  echo "Empty new USFR facts file."
  exit 1
fi
apyNew=$(grep secYield "$jsonNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$apyNew" ] || [ "$apyNew" = "null" ]; then
  echo "New USFR facts file has empty APY."
  exit 1
fi
dateNew=$(grep asOfDate "$jsonNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
  echo "New USFR facts file does not include dates."
  exit 1
fi
echo dateNew=$dateNew
#
# cloudFlare files.
#
if [ -s "$jsonFlare" ]; then
  dateFlare=$(grep asOfDate "$jsonFlare" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
  dateFlare=""
  echo "USFR cloudFlare facts file not has been published."
  dir=$(dirname "$jsonFlare")
  [ -d "$dir" ] || mkdir -p "$dir"
fi
echo dateFlare=$dateFlare
if [[ $dateFlare < $dateNew ]]; then
  cat "$jsonNew" >"$jsonFlare"
  echo "published updated USFR cloudFlare facts file."
fi
exit 0
