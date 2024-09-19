source ../meta.`hostname`.bash
jsonNew=USFR-distro-new.json
jsonPub="$publishHome/USFR/USFR-distros.json"
#echo jsonNew=$jsonNew
#echo jsonPub=$jsonPub

#echo "Starting node retrieval app."
node ./node-USFR-distro-json.js > $jsonNew
if [ ! $? ]
then
  echo "USFR distro retrieval failed, exiting."
  exit 1
fi
lenNew=`grep -o returnOfCapital "$jsonNew" | wc -l`
if [ -f "$jsonPub" ]
then
  lenPub=`grep -o returnOfCapital "$jsonPub" | wc -l`
else
  lenPub=0
fi
echo "entries new($lenNew) :: pub($lenPub)"
if [ $lenNew -le $lenPub ]
then
  echo 'new distro file is not longer than published file, exiting.'
else
  # I am trying cat instead of cp because Google Drive sometimes makes a (1) copy of the file.
  cat "$jsonNew" > "$jsonPub"
  echo "published (cat>) updated USFR distro history file."
fi
exit 0