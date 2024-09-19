source ../meta.`hostname`.bash
jsonNew=USFR-facts-new.json
jsonPub="$publishHome/USFR/USFR-facts.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub
#echo "Starting node retrieval app."
node ./node-USFR-facts-json.js > $jsonNew
if [ ! $? ]
then
  echo "USFR facts retrieval failed, exiting."
  exit 1
fi
cat "$jsonNew" > "$jsonPub"
echo "published updated USFR facts file."
exit 0