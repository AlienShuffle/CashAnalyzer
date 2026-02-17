../bin/MM-update-common-job.sh \
  --accountClass Funds \
  --pubDelay 18 --runDelay 4 "$@"

../bin/ETF-distro-update-common-job.sh --ticker "USFR" "$@"

# need to implement facts page.....

cat history/USFR-rate-new.json |
    ../bin/ETF-facts-update-common-job.sh --nodeArg "USFR" "$@"