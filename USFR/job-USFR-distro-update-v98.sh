source ../meta.$(hostname).sh
jsonNew="USFR-distro-new-v98.json"
jsonFlare="$cloudFlareHome/ETFs/USFR/USFR-distros.json"
jsonUnique="USFR-distro-new-unique-v98.json"
#echo jsonNew=$jsonNew
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update these delayHours as appropriate for the data source.
updateDelayHours=48
updateDelaySeconds=$(($updateDelayHours * 60 * 60))
if [ -f "$jsonFlare" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonFlare")))" -lt "$updateDelaySeconds" ]; then
  echo "Published file is not yet $updateDelayHours hours old - $(stat -c '%y' "$jsonFlare" | cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
runDelayHours=12
runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ -f "$jsonNew" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonNew")))" -lt "$runDelaySeconds" ]; then
  echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$jsonNew" | cut -d: -f1,2)"
  [ -z "$1" ] && exit 0
fi
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
#echo "Starting node retrieval app."
node ./node-USFR-distro-json-v98.js | jq . >"$jsonNew"
if [ ! $? ]; then
  echo "USFR distro retrieval failed, exiting."
  exit 1
fi
if [ ! -s "$jsonNew" ]; then
  echo "Empty new USFR distro file."
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
  echo "published updated cloudFlare USFR distro history file."
fi
exit 0
