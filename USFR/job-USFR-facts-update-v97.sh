source ../meta.`hostname`.sh
jsonNew=USFR-facts-new-v97.json
jsonPub="$publishHome/USFR/USFR-facts-v97.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub
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