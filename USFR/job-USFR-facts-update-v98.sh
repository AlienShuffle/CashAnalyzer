source ../meta.$(hostname).sh
jsonNew=USFR-facts-new-v98.json
jsonFlare="$cloudFlareHome/Funds/USFR/USFR-facts.json"
#echo jsonNew=$jsonNew
#
# preamble - test to see how long since this last run occured, skip out if this run is too soon.
#  - note, if $1 to to this script is not empty, I will run the script regardless, but report the aging status too.
#
# update these delayHours as appropriate for the data source.
pubDelayHours=18
runDelayHours=4
pubDelayFile="$jsonFlare"
runDelayFile="$jsonNew"
source ../bin/testDelays.sh

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
if [ ! -s "$jsonFlare" ]; then
  echo "USFR cloudFlare facts file not has been published."
  dir=$(dirname "$jsonFlare")
  [ -d "$dir" ] || mkdir -p "$dir"
fi
if ../bin/jsonDifferent.sh "$jsonFlare" "$jsonNew"; then
  cat "$jsonNew" >"$jsonFlare"
  echo "published updated USFR cloudFlare facts file."
fi
#
# Turn current SEC Yield data into a rates history similar to MM funds, but in the Funds folder.
#
cat $jsonNew |
  ../bin/MM-update-common-job.sh \
    --accountClass Funds \
    --processScript ./node-update-USFR-yields.js \
    --nodeArg USFR \
    --pubDelay 20 --runDelay 2 "$@"
exit 0
