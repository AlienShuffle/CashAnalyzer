 ../bin/ETF-facts-update-common-job.sh "$@"
 
[ -f history/USFR-facts-new.json ] && \
cat history/USFR-facts-new.json | ../bin/MM-update-common-job.sh \
  --accountClass Funds \
  --pubDelay 18 --runDelay 4 "$@"

../bin/ETF-distro-update-common-job.sh --ticker USFR "$@"

   