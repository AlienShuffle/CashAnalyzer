source ../meta.$(hostname).sh
jsonNew=CashPlus-facts-new-v98.json
jsonPub="$publishHome/CashPlus/CashPlus-facts-v98.json"
echo publishHome=\'$publishHome\'
echo jsonNew=$jsonNew
echo jsonPub=$jsonPub
#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
node ./node-CashPlus-facts-v98.js | jq . >"$jsonNew"
if [ ! $? ]; then
  echo "CashPlus facts retrieval failed, exiting."
  exit 1
fi
if [ ! -s "$jsonNew" ]; then
  echo "Empty CashPlus facts file."
  exit 1
fi
dateNew=$(grep asOfDate "$jsonNew" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
if [ -z "$dateNew" ]; then
  echo "New CashPlus facts file does not include dates."
  exit 1
fi
echo dateNew=$dateNew
if [ -s "jsonPub" ]; then
  datePub=$(grep asOfDate "$jsonPub" | cut -d: -f2 | sed 's/\"//g' | sed 's/,//g' | sed 's/ //g')
else
  datePub=""
  echo "CashPlus facts file has not been published"
  dir=$(dirname "$jsonPub")
  echo dir=\'$dir\'
  [ -d "$dir" ] || mkdir "$dir"
fi
echo datePub=$datePub
if [[ $datePub < $dateNew ]]; then
  cat "$jsonNew" >"$jsonPub"
  echo "published updated CashPlus facts file."
fi
exit 0
