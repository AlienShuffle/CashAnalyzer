 #!/usr/bin/bash
 
 [ -d "history/USFR" ] || mkdir -p "history/USFR"

 ../bin/ETF-facts-update-common-job.sh "$@"
 
[ -f history/USFR-facts-new.json ] && \
../bin/MM-update-common-job.sh \
  --accountClass Funds \
  --inputFile history/USFR-facts-new.json \
  --pubDelay 18 --runDelay 4 "$@"

../bin/ETF-distro-update-common-job.sh --ticker USFR "$@"
   