../bin/FedInvest-update-common-job.sh \
    --sourceName mktBonds \
    --outputName mktTips \
    --collectionScript ./collect-mktTips.sh \
    --processScript ./node-mktTips-update.mjs \
    --csvFields cusip,interest_rate,security_term,series,maturity_date,dated_date,report_source,asOfDate,settle_date,fwd_date,settle_clean_price,dated_refcpi,settle_refcpi,fwd_refcpi,settle_mature_sa_ratio,settle_mature_sa_ratio_decay,fwd_mature_sa_ratio,fwd_mature_sa_ratio_decay,repo_rate,fwd_clean_price_unadjusted \
    "$@"
