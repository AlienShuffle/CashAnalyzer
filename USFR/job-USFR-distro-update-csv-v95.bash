source ../meta.`hostname`.bash

#
# this script was used in All Funds version 8 (fintools v95), and can be retired when v8 is completely retired.
#
csvNew=USFR-distro-new-v95.csv
csvPub="$publishHome/USFR/USFR-distros-v95.csv"
#echo csvNew=$csvNew
#echo csvPub=$csvPub
#echo "Starting node retrieval app."
node ./node-USFR-distro-csv-v95.js > $csvNew
if [ ! $? ]
then
  echo "USFR distro retrieval failed, exiting."
  exit 1
fi
lenNew=`wc -l < "$csvNew"`
lenPub=`wc -l < "$csvPub"`
echo "wc -l new($lenNew) :: pub($lenPub)"
if [ $lenNew -le $lenPub ]
then
  echo 'new distro file is not longer than published file, exiting.'
else
  cat "$csvNew" > "$csvPub"
  echo "published updated USFR distro history file."
fi
exit 0