#npm start
node ./usfr-distro-cvs.js > usfr-distro-new.cvs
if [ ! $? ]
then
  echo "USFR distro retrieval failed, exiting."
  exit 1
fi
if diff usfr-distro-new.cvs /mnt/h/My\ Drive/CashAnalyzer/USFR/USFR-distros.csv 
then
  echo "No changes to USFR distro files, no update published."
else
  echo "published updated USFR distro history file."
  cp usfr-distro-new.cvs /mnt/h/My\ Drive/CashAnalyzer/USFR/USFR-distros.csv
fi
exit 0