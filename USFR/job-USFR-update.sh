../bin/MM-update-common-job.sh \
  --accountClass Funds \
  --processScript ./node-USFR-yield-update.js \
  --pubDelay 20 --runDelay 2 "$@"

../bin/ETF-distro-update-common-job.sh --ticker "USFR" "$@"

# need to implement facts page.....

