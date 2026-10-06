set -o pipefail

source ../meta.common.sh
curveCloudflareDir="$cloudFlareHome/Treasuries/mktBonds"
curveDailyDir="$curveCloudflareDir/daily"
mkdir -p "$curveDailyDir"

csvFields=cusip,interest_rate,security_term,series,maturity_date,dated_date,report_source,asOfDate,settle_date,fwd_date,settle_clean_price,dated_refcpi,settle_refcpi,fwd_refcpi,settle_mature_sa_ratio,settle_mature_sa_ratio_decay,fwd_mature_sa_ratio,fwd_mature_sa_ratio_decay,repo_rate,fwd_clean_price_unadjusted,settle_ytm,settle_sa_ytm,settle_sa_decay_ytm,forward_ytm,forward_sa_ytm,forward_sa_decay_ytm

# publishCurve <basis> <output name>: settle = settlement-date curve, settle-sa = settle with settle_mature_sa_ratio applied, forward = maxREFCPI-date curve, forward-sa = same with fwd_mature_sa_ratio applied, forward-sa-decay = same with fwd_mature_sa_ratio_decay applied.
publishCurve() {
    local basis="$1" name="$2"
    local sourceBasis="$tipSourceSide-$basis"
    local curveOutput="history/$name-rate-new.json"
    local tmpCurveOutput="$curveOutput.tmp.$$"
    local curveJsonFlare="$curveCloudflareDir/$name-rate.json"
    local curveCsvFlare="$curveCloudflareDir/$name-rate.csv"
    local nominalName="mktNominal-curve-$priceSide"
    [[ "$basis" == forward* ]] && nominalName="mktNominal-curve-fwd-$priceSide"
    if ! node ./node-calc-mktTips-curve.mjs "--basis=$basis" "--nominalCurve=history/$nominalName-rate-new.json" <"$curveInput" | jq --arg basis "$sourceBasis" '.basis = $basis' >"$tmpCurveOutput"; then
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
            echo 'cusip, asOfDate, basis, settleDate, maturity, coupon, marketClean, modelClean, priceResidual, marketYtm, modelYtm, residualBp, richCheap, nominalMarketYtm, marketBei, nominalModelYtm, modelBei'
            jq -r --arg asOfDate "$asOfDate" --arg basis "$sourceBasis" --arg settleDate "$(jq -r '.settleDate' "$curveOutput")" \
                '.rows[] | [.cusip, $asOfDate, $basis, $settleDate, .maturity, .coupon, .marketClean, .modelClean, .priceResidual, .marketYtm, .modelYtm, .residualBp, .richCheap, .nominalMarketYtm, .marketBei, .nominalModelYtm, .modelBei] | @csv' \
                "$curveOutput"
        ) >"$curveCsvFlare"
        cp "$curveJsonFlare" "$curveDailyDir/$asOfDate-$name.json"
        cp "$curveCsvFlare" "$curveDailyDir/$asOfDate-$name.csv"
        echo "published $action $name cloudFlare rate files."
    fi
}


# publishNominalCurve <basis> <output name>: Svensson nominal zero curve (6-month points to 30 years) from the mktBonds ask quotes.
publishNominalCurve() {
    local basis="$1" name="$2"
    local sourceBasis="$nominalSource-$priceSide-$basis"
    local curveOutput="history/$name-rate-new.json"
    local tmpCurveOutput="$curveOutput.tmp.$$"
    local curveJsonFlare="$curveCloudflareDir/$name-rate.json"
    local curveCsvFlare="$curveCloudflareDir/$name-rate.csv"
    if ! node ./node-calc-mktBonds-curve.mjs "--basis=$basis" "--priceSide=$priceSide" "--mktBonds=$curveCloudflareDir/mktBonds-rate.json" <"$curveInput" | jq --arg basis "$sourceBasis" '.basis = $basis' >"$tmpCurveOutput"; then
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
            echo 'asOfDate, basis, curveDate, term, date, zeroCc, zeroBey, discountFactor'
            jq -r --arg asOfDate "$asOfDate" --arg basis "$sourceBasis" --arg curveDate "$(jq -r '.settleDate' "$curveOutput")" \
                '.points[] | [$asOfDate, $basis, $curveDate, .term, .date, .zeroCc, .zeroBey, .discountFactor] | @csv' \
                "$curveOutput"
        ) >"$curveCsvFlare"
        cp "$curveJsonFlare" "$curveDailyDir/$asOfDate-$name.json"
        cp "$curveCsvFlare" "$curveDailyDir/$asOfDate-$name.csv"
        echo "published $action $name cloudFlare rate files."
    fi
}

runTipsSide() {
    local side="$1"
    shift
    ../bin/FedInvest-update-common-job.sh \
        --sourceName mktBonds \
        --outputName "mktTips-$side" \
        --collectionScript ./collect-mktTips.sh \
        --processScript ./node-mktTips-update.mjs \
        --csvFields "$csvFields" \
        -nodeArg "--priceSide=$side" \
        --nightDelayHour 8 \
        --pubDelay 3 \
        "$@" || return $?

    priceSide="$side"
    curveInput="$curveCloudflareDir/mktTips-$side-rate.json"
    if [ ! -s "$curveInput" ]; then
        echo "Missing published mktTips input: $curveInput" >&2
        return 1
    fi
    curveReportSource=$(jq -er '[.[].report_source] | unique | if length == 1 then .[0] else error("mktTips rows must have one report_source") end' "$curveInput") || return $?
    tipSourceSide=${curveReportSource// /-}
    nominalSource=${curveReportSource% *}
    nominalSource=${nominalSource// /-}

    # The TIPS curves need the nominal curve of the same date and quote side.
    publishNominalCurve settle "mktNominal-curve-$side" || return $?
    publishNominalCurve forward "mktNominal-curve-fwd-$side" || return $?
    publishCurve settle "mktTips-curve-$side" || return $?
    publishCurve settle-sa "mktTips-curve-sa-$side" || return $?
    publishCurve forward "mktTips-curve-fwd-$side" || return $?
    publishCurve forward-sa "mktTips-curve-fwd-sa-$side" || return $?
    publishCurve forward-sa-decay "mktTips-curve-fwd-sa-decay-$side" || return $?
}

for priceSide in ask bid; do
    runTipsSide "$priceSide" "$@" || exit $?
done

writeCsvManifest() {
    local directory="$1" pattern="$2" manifest="$3"
    local tmpManifest="$directory/$manifest.tmp.$$"
    if ! find "$directory" -maxdepth 1 -type f -name "$pattern" -printf '%f\n' | sort >"$tmpManifest"; then
        rm -f "$tmpManifest"
        return 1
    fi
    mv "$tmpManifest" "$directory/$manifest"
}

writeCsvManifest "$curveCloudflareDir" 'mktTips-*.csv' mktTips-manifest.txt || exit $?
writeCsvManifest "$curveCloudflareDir" 'mktNominal-*.csv' mktNominal-manifest.txt || exit $?
writeCsvManifest "$curveDailyDir" '*-mktTips-*.csv' mktTips-manifest.txt || exit $?
writeCsvManifest "$curveDailyDir" '*-mktNominal-*.csv' mktNominal-manifest.txt || exit $?
