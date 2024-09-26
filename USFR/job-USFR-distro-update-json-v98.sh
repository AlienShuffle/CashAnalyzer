source ../meta.$(hostname).sh
jsonNew="USFR-distro-new-v98.json"
jsonPub="$publishHome/USFR/USFR-distros-v98.json"
jsonUnique="USFR-distro-new-unique-v98.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub

#
# this script was used in fintools version 98 and later. This is intended to stick around long-term.
#
#echo "Starting node retrieval app."
node ./node-USFR-distro-json-v98.js | jq . >"$jsonNew"
if [ ! $? ]; then
  echo "USFR distro retrieval failed, exiting."
  exit 1
fi
# this should merge the old and new, removing duplicates and keeping newest.
jq -s 'flatten | unique_by(.exDividendDate) | reverse' "$jsonNew" "$jsonPub" >"$jsonUnique"
lenNew=$(grep -o returnOfCapital "$jsonNew" | wc -l)
if [ -f "$jsonPub" ]; then
  lenPub=$(grep -o returnOfCapital "$jsonPub" | wc -l)
else
  lenPub=0
fi
echo "entries new($lenNew) :: pub($lenPub)"
lenUnique=$(grep -o returnOfCapital "$jsonUnique" | wc -l)
echo "entries unique($lenUnique)"
if [ $lenNew -le $lenPub -a $lenUnique -le $lenPub ]; then
  echo 'new distro file is not longer than published file, exiting.'
else
  # I am trying cat instead of cp because Google Drive sometimes makes a (1) copy of the file.
  # note, the cat still allows the (1) copy to be created, not sure what is up there.
  cat "$jsonUnique" >"$jsonPub"
  echo "published (cat>) updated USFR distro history file."
fi
exit 0
