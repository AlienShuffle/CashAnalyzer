jsonNew=usfr-distro-new.json
jsonPub='/mnt/c/Users/alan/My Drive (readngtndude@gmail.com)/CashAnalyzer/USFR/USFR-distros.json'
echo jsonNew=$jsonNew
echo jsonPub=$jsonPub

echo "Starting node retrieval app."
node ./usfr-distro-json.js > $jsonNew
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
echo "wc -l new($lenNew) :: pub($lenPub)"
if [ $lenNew -le $lenPub ]
then
  echo 'new distro file is not longer than published file, exiting.'
else
  echo "published updated USFR distro history file."
  cp "$jsonNew" "$jsonPub"
fi
exit 0