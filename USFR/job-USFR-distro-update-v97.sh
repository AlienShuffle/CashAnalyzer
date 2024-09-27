source ../meta.$(hostname).sh
jsonNew=USFR-distro-new-v97.json
jsonPub="$publishHome/USFR/USFR-distros-v97.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub
# update these delayHours as appropriate for the data source.
updateDelayHours=24
updateDelaySeconds=$(($updateDelayHours * 60 * 60))
if [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonPub")))" -lt "$updateDelaySeconds" ]; then
  echo "Published file is not yet $updateDelayHours hours old."
  [ -z "$1" ] && exit 0
fi
runDelayHours=12
runDelaySeconds=$(($runDelayHours * 60 * 60))
if [ "$(($(date +"%s") - $(stat -c "%Y" "$jsonNew")))" -lt "$runDelaySeconds" ]; then
  echo "Last Run is not yet $runDelayHours hours old."
  [ -z "$1" ] && exit 0
fi
#
# this script was used in All Funds version 9 (sheets using fintools v97), and can be retired when v9 is completely retired.
#
#echo "Starting node retrieval app."
node ./node-USFR-distro-json-v97.js | jq -S . >"$jsonNew"
if [ ! $? ]; then
  echo "USFR distro retrieval failed, exiting."
  exit 1
fi
lenNew=$(grep -o returnOfCapital "$jsonNew" | wc -l)
if [ -f "$jsonPub" ]; then
  lenPub=$(grep -o returnOfCapital "$jsonPub" | wc -l)
else
  lenPub=0
fi
echo "entries new($lenNew) :: pub($lenPub)"
if [ $lenNew -le $lenPub ]; then
  echo 'new distro file is not longer than published file, exiting.'
else
  # I am trying cat instead of cp because Google Drive sometimes makes a (1) copy of the file.
  cat "$jsonNew" >"$jsonPub"
  echo "published (cat>) updated USFR distro history file."
fi
exit 0
