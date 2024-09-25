source ../meta.`hostname`.bash
jsonNew=USFR-facts-new-v98.json
jsonPub="$publishHome/USFR/USFR-facts-v98.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
#echo "Starting node retrieval app."
node ./node-USFR-facts-json-v98.js | jq . > "$jsonNew"
if [ ! $? ]
then
  echo "USFR facts retrieval failed, exiting."
  exit 1
fi
cat "$jsonNew" > "$jsonPub"
echo "published updated USFR facts file."
exit 0