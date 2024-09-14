source ../meta.`hostname`.bash
csvNew=USFR-distro-new.csv
csvPub="$publishHome/USFR/USFR-distros.csv"
#echo csvNew=$csvNew
#echo csvPub=$csvPub
#echo "Starting node retrieval app."
node ./node-USFR-distro-csv.js > $csvNew
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
  cp "$csvNew" "$csvPub"
  echo "published updated USFR distro history file."
fi
exit 0