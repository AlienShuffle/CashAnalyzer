../bin/FedInvest-update-common-job.sh \
    --collectionScript ./collect-$(basename $(pwd)).sh \
    --processScript ./node-mktBonds-update.mjs \
    --csvFields asOfDate,cusip,securitytype,rate,maturitydate,bid,ask,frequency,description,key \
    --nightDelayHour 8 \
    --pubDelay 3 \
    "$@"
