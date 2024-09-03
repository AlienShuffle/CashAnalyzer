#npm start
cvsNew=usfr-distro-new.cvs
cvsPub='/mnt/h/My Drive/CashAnalyzer/USFR/USFR-distros.csv'
echo cvsNew=$cvsNew
echo cvsPub=$cvsPub
while true
do
  echo "Starting node retrieval app."
  node ./usfr-distro-cvs.js > $cvsNew
  if [ ! $? ]
  then
    echo "USFR distro retrieval failed, exiting."
    exit 1
  fi
  lenNew=`wc -l < "$cvsNew"`
  lenPub=`wc -l < "$cvsPub"`
  echo "wc -l new($lenNew) :: pub($lenPub)"
  if [ $lenNew -le $lenPub ]
  then
    echo 'new distro file is not longer than published file, exiting.'
  else
    echo "published updated USFR distro history file."
    cp "$cvsNew" "$cvsPub"
  fi
  echo "sleeping 6 hours @ `date`"
  sleep 6h
done
exit 0