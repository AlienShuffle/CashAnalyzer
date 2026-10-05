set -o pipefail

../bin/FedInvest-update-common-job.sh \
    --sourceName mktBonds \
    --outputName mktTips \
    --collectionScript ./collect-mktTips.sh \
    --processScript ./node-mktTips-update.mjs \
    --csvFields cusip,interest_rate,security_term,series,maturity_date,dated_date,report_source,asOfDate,settle_date,fwd_date,settle_clean_price,dated_refcpi,settle_refcpi,fwd_refcpi,settle_mature_sa_ratio,settle_mature_sa_ratio_decay,fwd_mature_sa_ratio,fwd_mature_sa_ratio_decay,repo_rate,fwd_clean_price_unadjusted \
    "$@" || exit $?

source ../meta.common.sh
curveInput="$cloudFlareHome/Treasuries/mktBonds/mktTips-rate.json"
if [ ! -s "$curveInput" ]; then
    echo "Missing published mktTips input: $curveInput" >&2
    exit 1
fi
curveCloudflareDir="$cloudFlareHome/Treasuries/mktBonds"
curveDailyDir="$curveCloudflareDir/daily"
mkdir -p "$curveDailyDir"

# publishCurve <basis> <output name>: settle = settlement-date curve, settle-sa = settle with settle_mature_sa_ratio applied, forward = maxREFCPI-date curve, forward-sa = same with fwd_mature_sa_ratio applied, forward-sa-decay = same with fwd_mature_sa_ratio_decay applied.
publishCurve() {
    local basis="$1" name="$2"
    local curveOutput="history/$name-rate-new.json"
    local tmpCurveOutput="$curveOutput.tmp.$$"
    local curveJsonFlare="$curveCloudflareDir/$name-rate.json"
    local curveCsvFlare="$curveCloudflareDir/$name-rate.csv"
    if ! node ./node-calc-mktTips-curve.mjs "--basis=$basis" <"$curveInput" | jq . >"$tmpCurveOutput"; then
        rm -f "$tmpCurveOutput"
        return 1
    fi
    mv "$tmpCurveOutput" "$curveOutput"

    local asOfDate
    asOfDate=$(jq -er '.asOfDate' "$curveOutput") || return $?
    if ../bin/jsonDifferent.sh "$curveOutput" "$curveJsonFlare"; then
        local action="updated"
        [ -s "$curveJsonFlare" ] || action="added"
        cp "$curveOutput" "$curveJsonFlare"
        (
            echo 'cusip, asOfDate, basis, settleDate, maturity, coupon, marketClean, modelClean, priceResidual, marketYtm, modelYtm, residualBp'
            jq -r --arg asOfDate "$asOfDate" --arg basis "$basis" --arg settleDate "$(jq -r '.settleDate' "$curveOutput")" \
                '.rows[] | [.cusip, $asOfDate, $basis, $settleDate, .maturity, .coupon, .marketClean, .modelClean, .priceResidual, .marketYtm, .modelYtm, .residualBp] | @csv' \
                "$curveOutput"
        ) >"$curveCsvFlare"
        cp "$curveJsonFlare" "$curveDailyDir/$asOfDate-$name.json"
        cp "$curveCsvFlare" "$curveDailyDir/$asOfDate-$name.csv"
        echo "published $action $name cloudFlare rate files."
    fi
}

publishCurve settle mktTips-curve || exit $?
publishCurve settle-sa mktTips-curve-sa || exit $?
publishCurve forward mktTips-curve-fwd || exit $?
publishCurve forward-sa mktTips-curve-fwd-sa || exit $?
publishCurve forward-sa-decay mktTips-curve-fwd-sa-decay || exit $?
