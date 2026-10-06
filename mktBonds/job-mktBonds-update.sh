../bin/FedInvest-update-common-job.sh \
    --collectionScript ./collect-$(basename $(pwd)).sh \
    --processScript ./node-mktBonds-update.mjs \
    --csvFields asOfDate,cusip,securitytype,rate,maturitydate,bid,ask,frequency,description,key \
    --nightDelayHour 8 \
    --pubDelay 3 \
    "$@" || exit $?

for priceSide in ask bid; do
    ../bin/FedInvest-update-common-job.sh \
        --sourceName mktBonds \
        --outputName "mktNominal-$priceSide" \
        --processScript ./node-mktNominals-update.mjs \
        --csvFields cusip,interest_rate,security_type,description,maturity_date,report_source,asOfDate,settle_date,fwd_date,settle_clean_price,repo_rate,fwd_clean_price,settle_ytm,forward_ytm \
        -nodeArg "--priceSide=$priceSide" \
        --nightDelayHour 8 \
        --pubDelay 3 \
        "$@" || exit $?
done
