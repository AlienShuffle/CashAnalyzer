source ../meta.$(hostname).sh
jsonNew="VBIL-distro-new-v98.json"
jsonFlare="$cloudFlareHome/ETFs/VBIL/VBIL-distros.json"
jsonUnique="VBIL-distro-new-unique.json"
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
curlFile=VBIL-file.json
curl -sSL -o- --referer https://investor.vanguard.com https://investor.vanguard.com/investment-products/etfs/profile/api/VBIL/distribution > "$curlFile"
node ./node-Vg-distro-update.js < "$curlFile" | jq . >"$jsonNew"
if [ ! $? ]; then
  echo "VBIL distro retrieval failed, exiting."
  exit 1
fi
if [ ! -s "$jsonNew" ]; then
  echo "Empty new VBIL distro file."
  exit 1
fi
# this should merge the old and new, removing duplicates and keeping newest.
if [ -s "$jsonFlare" ]; then
  jq -s 'flatten | unique_by(.exDividendDate) | reverse' "$jsonNew" "$jsonFlare" >"$jsonUnique"
else
  cat "$jsonNew" >"$jsonUnique"
fi
# publish cloudFlare files.
lenNew=$(grep -o returnOfCapital "$jsonNew" | wc -l)
if [ -s "$jsonFlare" ]; then
  lenFlare=$(grep -o totalDistribution "$jsonFlare" | wc -l)
else
  lenFlare=0
  echo "VBIL distro cloudFlare history file has not been published."
  dir=$(dirname "$jsonFlare")
  [ -d "$dir" ] || mkdir -p "$dir"
fi
echo "entries new($lenNew) :: pub($lenFlare)"
lenUnique=$(grep -o totalDistribution "$jsonUnique" | wc -l)
echo "entries unique($lenUnique)"
if [ $lenUnique -gt $lenFlare ]; then
  cat "$jsonUnique" >"$jsonFlare"
  echo "published updated cloudFlare VBIL distro history file."
fi
exit 0
