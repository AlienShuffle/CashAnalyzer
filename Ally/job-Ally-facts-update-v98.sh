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
if [ ! -s "$jsonNew" ]; then
  echo "Empty Ally facts file."
  exit 1
fi
dateNew=$(grep asOfDate "$jsonNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
  echo "New Ally facts file does not include dates."
  exit 1
fi
echo dateNew=$dateNew

if [ -s "jsonPub" ]; then
  datePub=$(grep asOfDate "$jsonPub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
  datePub=""
  echo "Ally facts file has not been published."
  dir=$(dirname "$jsonPub")
  [ -d "$dir" ] || mkdir "$dir"
fi
echo datePub=$datePub
if [[ $datePub < $dateNew ]]; then
  cat "$jsonNew" >"$jsonPub"
  echo "published updated Ally facts file."
fi
exit 0
