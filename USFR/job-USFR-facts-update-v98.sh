source ../meta.$(hostname).sh
jsonNew=USFR-facts-new-v98.json
jsonPub="$publishHome/USFR/USFR-facts-v98.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub
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
dateNew=$(grep asOfDate "$jsonNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
  echo "New USFR facts file does not include dates."
  exit 1
fi
echo dateNew=$dateNew
datePub=$(grep asOfDate "$jsonPub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
echo datePub=$datePub
if [[ $datePub < $dateNew ]]; then
  cat "$jsonNew" >"$jsonPub"
  echo "published updated USFR facts file."
fi
exit 0
