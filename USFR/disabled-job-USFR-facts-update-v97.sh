source ../meta.`hostname`.sh
jsonNew=USFR-facts-new-v97.json
jsonPub="$publishHome/ETFs/USFR/USFR-facts-v97.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update these delayHours as appropriate for the data source.
updateDelayHours=12
updateDelaySeconds=$(($updateDelayHours * 60 * 60))
if [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonPub")))" -lt "$updateDelaySeconds" ]; then
  echo "Published file is not yet $updateDelayHours hours old."
  [ -z "$1" ] && exit 0
fi
runDelayHours=3
runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonNew")))" -lt "$runDelaySeconds" ]; then
  echo "Last Run is not yet $runDelayHours hours old."
  [ -z "$1" ] && exit 0
fi
#
# this script was used in All Funds version 9 (sheets using fintools v97), and can be retired when v9 is completely retired.
#
#echo "Starting node retrieval app."
node ./node-USFR-facts-json-v97.js | jq -S . > "$jsonNew"
if [ ! $? ]
then
  echo "USFR facts retrieval failed, exiting."
  exit 1
fi
cat "$jsonNew" > "$jsonPub"
echo "published updated USFR facts file."
exit 0