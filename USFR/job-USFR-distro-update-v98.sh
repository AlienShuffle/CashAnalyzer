source ../meta.$(hostname).sh
jsonNew="USFR-distro-new-v98.json"
jsonPub="$publishHome/ETFs/USFR/USFR-distros-v98.json"
jsonUnique="USFR-distro-new-unique-v98.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update these delayHours as appropriate for the data source.
updateDelayHours=48
updateDelaySeconds=$(($updateDelayHours * 60 * 60))
if [ -f "$jsonPub" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonPub")))" -lt "$updateDelaySeconds" ]; then
  echo "Published file is not yet $updateDelayHours hours old - $(stat -c '%y' "$jsonPub" | cut -d: -f1,2)"
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
if [ -s "$jasonPub" ]; then
  jq -s 'flatten | unique_by(.exDividendDate) | reverse' "$jsonNew" "$jsonPub" >"$jsonUnique"
else
  cat "$jsonNew" >"$jsonUnique"
fi

lenNew=$(grep -o returnOfCapital "$jsonNew" | wc -l)
if [ -s "$jsonPub" ]; then
  lenPub=$(grep -o returnOfCapital "$jsonPub" | wc -l)
else
  lenPub=0
  echo "USFR distro history file has not been published."
  dir=$(dirname "$jsonPub")
  [ -d "$dir" ] || mkdir "$dir"
fi
echo "entries new($lenNew) :: pub($lenPub)"
lenUnique=$(grep -o returnOfCapital "$jsonUnique" | wc -l)
echo "entries unique($lenUnique)"
if [ $lenUnique -gt $lenPub ]; then
  cat "$jsonUnique" >"$jsonPub"
  echo "published updated USFR distro history file."
fi
exit 0
