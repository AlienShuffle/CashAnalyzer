source ../meta.$(hostname).sh
jsonNew=Ally-facts-new-v98.json
jsonPub="$publishHome/Ally/Ally-facts-v98.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
node ./node-Ally-facts-v98.js | jq . >"$jsonNew"
if [ ! $? ]; then
  echo "Ally facts retrieval failed, exiting."
  exit 1
fi
dateNew=$(grep asOfDate "$jsonNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
echo dateNew=$dateNew
datePub=$(grep asOfDate "$jsonPub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
echo datePub=$datePub
if [[ $datePub < $dateNew ]]; then
  cat "$jsonNew" >"$jsonPub"
  echo "published updated Ally facts file."
fi
exit 0
