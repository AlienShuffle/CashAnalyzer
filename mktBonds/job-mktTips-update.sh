set -o pipefail

sourceName="${BOND_SOURCE_NAME:-mktBonds}"
reportPrefix="${BOND_REPORT_PREFIX:-mkt}"
reportSource="${BOND_REPORT_SOURCE:-Market}"
scriptDir=../mktBonds
asOfArg=""
jobArgs=()
for arg in "$@"; do
    case "$arg" in
        --asOfDate=*) asOfArg=" $arg" ;;
        *) jobArgs+=("$arg") ;;
    esac
done
set -- "${jobArgs[@]}"

source ../meta.common.sh
curveCloudflareDir="$cloudFlareHome/Treasuries/$sourceName"
quoteFile="$curveCloudflareDir/$sourceName-rate.json"
curveDailyDir="$curveCloudflareDir/daily"
mkdir -p "$curveDailyDir"

csvFields=cusip,interest_rate,security_term,series,maturity_date,dated_date,report_source,asOfDate,settle_date,fwd_date,settle_clean_price,dated_refcpi,settle_refcpi,fwd_refcpi,settle_mature_sa_ratio,settle_mature_sa_ratio_decay,fwd_mature_sa_ratio,fwd_mature_sa_ratio_decay,repo_rate,fwd_clean_price,settle_ytm,settle_sa_ytm,settle_sa_decay_ytm,forward_ytm,forward_sa_ytm,forward_sa_decay_ytm,settle_sao,forward_sao,settle_sao_tweak,forward_sao_tweak

# publishCurve <basis> <output name>: settle = settlement-date curve, settle-sa = settle with settle_mature_sa_ratio applied, forward = maxREFCPI-date curve, forward-sa = same with fwd_mature_sa_ratio applied, forward-sa-decay = same with fwd_mature_sa_ratio_decay applied.
publishCurve() {
    local basis="$1" name="$2"
    local sourceBasis="$tipSourceSide-$basis"
    local curveOutput="history/$name-rate-new.json"
    local tmpCurveOutput="$curveOutput.tmp.$$"
    local curveJsonFlare="$curveCloudflareDir/$name-rate.json"
    local curveCsvFlare="$curveCloudflareDir/$name-rate.csv"
    local nominalName="${reportPrefix}Nominal-grid-$priceSide"
    [[ "$basis" == forward* ]] && nominalName="${reportPrefix}Nominal-grid-fwd-$priceSide"
    if ! node "$scriptDir/node-calc-mktTips-curve.mjs" "--basis=$basis" "--nominalCurve=history/$nominalName-rate-new.json" <"$curveInput" | jq --arg basis "$sourceBasis" '.basis = $basis' >"$tmpCurveOutput"; then
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
            echo 'cusip, asOfDate, basis, settleDate, maturity, coupon, marketClean, modelClean, priceResidual, marketYtm, modelYtm, residualBp, richCheap, nominalMarketYtm, marketBei, nominalModelYtm, modelBei, nominalResidualBp, beiResidualBp, zeroBei'
            jq -r --arg asOfDate "$asOfDate" --arg basis "$sourceBasis" --arg settleDate "$(jq -r '.settleDate' "$curveOutput")" \
                '.rows[] | [.cusip, $asOfDate, $basis, $settleDate, .maturity, .coupon, .marketClean, .modelClean, .priceResidual, .marketYtm, .modelYtm, .residualBp, .richCheap, .nominalMarketYtm, .marketBei, .nominalModelYtm, .modelBei, .nominalResidualBp, .beiResidualBp, .zeroBei] | @csv' \
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
    if ! node "$scriptDir/node-calc-mktBonds-curve.mjs" "--basis=$basis" "--priceSide=$priceSide" "--mktBonds=$quoteFile" <"$curveInput" | jq --arg basis "$sourceBasis" '.basis = $basis' >"$tmpCurveOutput"; then
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

# publishBeiGrid <TIPS curve name> <output name>: TIPS and nominal zero rates, and their BEI spread, on the
# 6-month grid to 30 years, from the TIPS curve fit and the nominal grid of the same valuation date.
publishBeiGrid() {
    local tipsName="$1" name="$2"
    local tipsCurve="history/$tipsName-rate-new.json"
    local nominalName="${reportPrefix}Nominal-grid-$priceSide"
    [[ "$tipsName" == "${reportPrefix}Tips-curve-fwd"* ]] && nominalName="${reportPrefix}Nominal-grid-fwd-$priceSide"
    local gridOutput="history/$name-rate-new.json"
    local tmpGridOutput="$gridOutput.tmp.$$"
    local gridJsonFlare="$curveCloudflareDir/$name-rate.json"
    local gridCsvFlare="$curveCloudflareDir/$name-rate.csv"
    if ! node "$scriptDir/node-calc-mktBei-grid.mjs" "--tipsCurve=$tipsCurve" "--nominalCurve=history/$nominalName-rate-new.json" >"$tmpGridOutput"; then
        rm -f "$tmpGridOutput"
        return 1
    fi
    mv "$tmpGridOutput" "$gridOutput"

    local asOfDate
    asOfDate=$(jq -er '.asOfDate' "$gridOutput") || return $?
    if ../bin/jsonDifferent.sh "$gridOutput" "$gridJsonFlare"; then
        local action="updated"
        [ -s "$gridJsonFlare" ] || action="added"
        cp "$gridOutput" "$gridJsonFlare"
        (
            echo 'asOfDate, basis, nominalBasis, curveDate, term, date, tipsZeroCc, tipsZeroBey, nominalZeroCc, nominalZeroBey, beiCc, beiBey'
            jq -r '. as $c | .points[] | [$c.asOfDate, $c.basis, $c.nominalBasis, $c.settleDate, .term, .date, .tipsZeroCc, .tipsZeroBey, .nominalZeroCc, .nominalZeroBey, .beiCc, .beiBey] | @csv' \
                "$gridOutput"
        ) >"$gridCsvFlare"
        cp "$gridJsonFlare" "$curveDailyDir/$asOfDate-$name.json"
        cp "$gridCsvFlare" "$curveDailyDir/$asOfDate-$name.csv"
        echo "published $action $name cloudFlare rate files."
    fi
}

runTipsSide() {
    local side="$1"
    shift
    ../bin/FedInvest-update-common-job.sh \
        --sourceName "$sourceName" \
        --outputName "${reportPrefix}Tips-$side" \
        --collectionScript "$scriptDir/collect-mktTips.sh" \
        --collectionArg "${BOND_TIPS_META_FILE:-}" \
        --processScript "$scriptDir/node-mktTips-update.mjs" \
        --csvFields "$csvFields" \
        -nodeArg "--priceSide=$side --mktBonds=$quoteFile --reportSource=$reportSource --settlementDays=${BOND_SETTLEMENT_DAYS:-1}$asOfArg" \
        --nightDelayHour 8 \
        --pubDelay 3 \
        "$@" || return $?

    priceSide="$side"
    curveInput="$curveCloudflareDir/${reportPrefix}Tips-$side-rate.json"
    if [ ! -s "$curveInput" ]; then
        echo "Missing published mktTips input: $curveInput" >&2
        return 1
    fi
    curveReportSource=$(jq -er '[.[].report_source] | unique | if length == 1 then .[0] else error("mktTips rows must have one report_source") end' "$curveInput") || return $?
    tipSourceSide=${curveReportSource// /-}
    nominalSource=${curveReportSource% *}
    nominalSource=${nominalSource// /-}

    # The TIPS curves need the nominal curve of the same date and quote side.
    publishNominalCurve settle "${reportPrefix}Nominal-grid-$side" || return $?
    publishNominalCurve forward "${reportPrefix}Nominal-grid-fwd-$side" || return $?
    publishCurve settle "${reportPrefix}Tips-curve-$side" || return $?
    publishCurve settle-sa "${reportPrefix}Tips-curve-sa-$side" || return $?
    publishCurve settle-sa-decay "${reportPrefix}Tips-curve-sa-decay-$side" || return $?
    publishCurve forward "${reportPrefix}Tips-curve-fwd-$side" || return $?
    publishCurve forward-sa "${reportPrefix}Tips-curve-fwd-sa-$side" || return $?
    publishCurve forward-sa-decay "${reportPrefix}Tips-curve-fwd-sa-decay-$side" || return $?

    local qualifier
    for qualifier in "" sa- sa-decay- fwd- fwd-sa- fwd-sa-decay-; do
        publishBeiGrid "${reportPrefix}Tips-curve-$qualifier$side" "${reportPrefix}Bei-grid-$qualifier$side" || return $?
    done
}

for priceSide in ask bid; do
    runTipsSide "$priceSide" "$@" || exit $?
done

# publishFitHistory: none/sa/sa-decay fit statistics for every archived TIPS curve snapshot, plus the
# sa-decay vs sa summary. Cumulative over the archive, so it is published without daily snapshots.
publishFitHistory() {
    local name="${reportPrefix}Tips-fitHistory"
    local output="history/$name-rate-new.json"
    local tmpOutput="$output.tmp.$$"
    local jsonFlare="$curveCloudflareDir/$name-rate.json"
    if ! node "$scriptDir/node-calc-mktTips-fitHistory.mjs" "--daily=$curveDailyDir" "--prefix=$reportPrefix" >"$tmpOutput"; then
        rm -f "$tmpOutput"
        return 1
    fi
    mv "$tmpOutput" "$output"
    if ../bin/jsonDifferent.sh "$output" "$jsonFlare"; then
        local action="updated"
        [ -s "$jsonFlare" ] || action="added"
        cp "$output" "$jsonFlare"
        (
            echo 'asOfDate, side, valuation, adjustment, curveDate, bonds, shortBonds, objective, rmsBp, shortRmsBp, longRmsBp, maxAbsBp, monthRangeBp, zero1y, zero2y'
            jq -r '.rows[] | [.asOfDate, .side, .valuation, .adjustment, .curveDate, .bonds, .shortBonds, .objective, .rmsBp, .shortRmsBp, .longRmsBp, .maxAbsBp, .monthRangeBp, .zero1y, .zero2y] | @csv' "$output"
        ) >"$curveCloudflareDir/$name-rate.csv"
        (
            echo 'side, valuation, snapshots, days, firstAsOfDate, lastAsOfDate, decayWins, decayWinShare, objectiveChangePct, rmsDeltaBp, shortRmsDeltaBp, longRmsDeltaBp, maxAbsDeltaBp, monthRangeDeltaBp, zero1yMeanAbsDiffBp, zero2yMeanAbsDiffBp, verdict'
            jq -r '.summary[] | [.side, .valuation, .snapshots, .days, .firstAsOfDate, .lastAsOfDate, .decayWins, .decayWinShare, .objectiveChangePct, .rmsDeltaBp, .shortRmsDeltaBp, .longRmsDeltaBp, .maxAbsDeltaBp, .monthRangeDeltaBp, .zero1yMeanAbsDiffBp, .zero2yMeanAbsDiffBp, .verdict] | @csv' "$output"
        ) >"$curveCloudflareDir/$name-summary-rate.csv"
        echo "published $action $name cloudFlare rate files."
        jq -r '.summary[] | "  \(.side) \(.valuation): \(.decayWins)/\(.snapshots) decay wins, objective \(.objectiveChangePct)%, \(.verdict)"' "$output"
    fi
}

if [ "${BOND_DAILY_ONLY:-false}" != true ]; then
    publishFitHistory || exit $?
fi

# publishBeiStability: settle against forward BEI stability, leave-one-out sensitivity and short-end fit
# across the archive. Leave-one-out refits are cached in history/ so each run only fits new snapshots.
publishBeiStability() {
    local name="${reportPrefix}Bei-stability"
    local output="history/$name-rate-new.json"
    local tmpOutput="$output.tmp.$$"
    local jsonFlare="$curveCloudflareDir/$name-rate.json"
    if ! node "$scriptDir/node-calc-mktBei-stability.mjs" "--daily=$curveDailyDir" "--prefix=$reportPrefix" "--cache=history/$name-cache.json" >"$tmpOutput"; then
        rm -f "$tmpOutput"
        return 1
    fi
    mv "$tmpOutput" "$output"
    if ../bin/jsonDifferent.sh "$output" "$jsonFlare"; then
        local action="updated"
        [ -s "$jsonFlare" ] || action="added"
        cp "$output" "$jsonFlare"
        local table
        for table in rows summary; do
            local csvName="$name-rate.csv"
            [ "$table" = summary ] && csvName="$name-summary-rate.csv"
            jq -r --arg table "$table" '.[$table] | (.[0] | keys_unsorted) as $keys | ($keys | join(", ")), (.[] | [.[$keys[]]] | @csv)' \
                "$output" >"$curveCloudflareDir/$csvName"
        done
        echo "published $action $name cloudFlare rate files."
        jq -r '.summary[] | select(.tenor == 1) | "  \(.side) \(.adjustment) 1y: stabler \(.stabler), robuster \(.robuster), fitter \(.fitter)"' "$output"
    fi
}

if [ "${BOND_DAILY_ONLY:-false}" != true ]; then
    publishBeiStability || exit $?
fi

writeCsvManifest() {
    local directory="$1" pattern="$2" manifest="$3"
    local tmpManifest="$directory/$manifest.tmp.$$"
    if ! find "$directory" -maxdepth 1 -type f -name "$pattern" -printf '%f\n' | sort >"$tmpManifest"; then
        rm -f "$tmpManifest"
        return 1
    fi
    mv "$tmpManifest" "$directory/$manifest"
}

for family in Tips Nominal Bei; do
    writeCsvManifest "$curveCloudflareDir" "${reportPrefix}$family-*.csv" "${reportPrefix}$family-manifest.txt" || exit $?
    writeCsvManifest "$curveDailyDir" "*-${reportPrefix}$family-*.csv" "${reportPrefix}$family-manifest.txt" || exit $?
done
