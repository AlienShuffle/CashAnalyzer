sourceName="${BOND_SOURCE_NAME:-mktBonds}"
reportPrefix="${BOND_REPORT_PREFIX:-mkt}"
reportSource="${BOND_REPORT_SOURCE:-Market}"
source ../meta.common.sh
quoteFile="$cloudFlareHome/Treasuries/$sourceName/$sourceName-rate.json"
asOfArg=""
jobArgs=()
for arg in "$@"; do
    case "$arg" in
        --asOfDate=*) asOfArg=" $arg" ;;
        *) jobArgs+=("$arg") ;;
    esac
done
set -- "${jobArgs[@]}"

../bin/FedInvest-update-common-job.sh \
    --sourceName "$sourceName" \
    --collectionScript "${BOND_COLLECTION_SCRIPT:-../mktBonds/collect-mktBonds.sh}" \
    --processScript "${BOND_PROCESS_SCRIPT:-../mktBonds/node-mktBonds-update.mjs}" \
    --csvFields asOfDate,cusip,securitytype,interest_rate,maturity_date,bid,ask,description \
    --nightDelayHour 8 \
    --pubDelay 3 \
    "$@" || exit $?

for priceSide in ask bid; do
    ../bin/FedInvest-update-common-job.sh \
        --sourceName "$sourceName" \
        --outputName "${reportPrefix}Nominal-$priceSide" \
        --processScript ../mktBonds/node-mktNominals-update.mjs \
        --csvFields cusip,interest_rate,security_type,description,maturity_date,report_source,asOfDate,settle_date,fwd_date,settle_clean_price,repo_rate,fwd_clean_price,settle_ytm,forward_ytm \
        -nodeArg "--priceSide=$priceSide --mktBonds=$quoteFile --reportSource=$reportSource --settlementDays=${BOND_SETTLEMENT_DAYS:-1}$asOfArg" \
        --nightDelayHour 8 \
        --pubDelay 3 \
        "$@" || exit $?
done
