import assert from "node:assert/strict";
import { normalizeDate, daysBetween } from "../../mktBonds/lib/dates.mjs";
import { forwardTipsCleanPrice } from "../../mktBonds/lib/forwards/forwardPrice.mjs";
import { tbillRepoRate } from "../../mktBonds/lib/forwards/tbill.mjs";
import { applyCredibilityFactor } from "../../mktBonds/lib/tips/credibility.mjs";
import { roundSeasonal, roundYield } from "../../mktBonds/lib/rounding.mjs";

export function commonStartRepo(quotes, side, settle, commonStart) {
    assert.ok(["ask", "bid"].includes(side), "Invalid release quote side");
    const bills = quotes.filter(row => row.securitytype === "Bill" && Number(row[side]) > 0)
        .map(row => ({ maturity: row.maturity_date, price: Number(row[side]) }));
    const fit = tbillRepoRate(settle, commonStart, bills);
    return { ...fit, rate: roundYield(fit.rate) };
}

export function releaseCpiPath(table, commonStart, trend) {
    const end = normalizeDate(commonStart), known = table.maxDate;
    assert.ok(Number.isFinite(trend) && end >= known, "Invalid release CPI projection");
    const anchor = table.getRefCpi(known);
    assert.ok(Number.isFinite(anchor) && anchor > 0, "Missing release CPI projection anchor");
    return date => {
        const day = normalizeDate(date);
        assert.ok(day && Number.isFinite(day.getTime()) && day <= end, "CPI requested beyond common start");
        // Never consult later actual CPI for the segment unknown at this snapshot.
        const value = day <= known ? table.getRefCpi(day)
            : anchor * Math.exp(trend * daysBetween(known, day) / 365);
        assert.ok(Number.isFinite(value) && value > 0, "Missing release CPI value");
        return value;
    };
}

export function commonStartRatio(table, commonStart, maturity, adjustment) {
    assert.ok(["none", "sa", "sa-decay"].includes(adjustment), "Invalid release adjustment");
    if (adjustment === "none") return 1;
    const forwardFactor = table.getFactor(commonStart), maturityFactor = table.getFactor(maturity);
    assert.ok(Number.isFinite(forwardFactor) && forwardFactor > 0
        && Number.isFinite(maturityFactor) && maturityFactor > 0, "Missing release seasonal factor");
    const denominator = adjustment === "sa-decay" && table.getRefCpi(maturity) == null
        ? applyCredibilityFactor(maturityFactor, commonStart, maturity) : maturityFactor;
    return roundSeasonal(forwardFactor / denominator);
}

export function commonStartPrice(row, price, getRefCpi, commonStart, ratio) {
    assert.ok(Number.isFinite(price) && price > 0 && Number.isFinite(ratio) && ratio > 0,
        "Invalid common-start price input");
    assert.ok(normalizeDate(row.settle_date) < normalizeDate(commonStart)
        && normalizeDate(row.maturity_date) > normalizeDate(commonStart), "Invalid common-start dates");
    const forward = forwardTipsCleanPrice({
        settle: row.settle_date, forward: commonStart, maturity: row.maturity_date,
        coupon: row.interest_rate, price, datedRefCpi: row.dated_refcpi,
        settleRefCpi: getRefCpi(normalizeDate(row.settle_date)),
        forwardRefCpi: getRefCpi(normalizeDate(commonStart)), repoRate: row.repo_rate, getRefCpi,
    });
    assert.ok(Number.isFinite(forward) && forward > 0, "Invalid common-start forward price");
    return forward * ratio;
}

// Bits select post values for quotes (1), CPI information (2), and roll/financing/seasonality (4).
export function releasePriceCube(before, after, paths, commonStart, ratios) {
    for (const field of ["cusip", "maturity_date", "interest_rate", "dated_refcpi"]) {
        assert.equal(before[field], after[field], `Matched bond metadata changed: ${field}`);
    }
    return Array.from({ length: 8 }, (_, mask) => commonStartPrice(
        mask & 4 ? after : before,
        (mask & 1 ? after : before).settle_clean_price,
        paths[mask & 2 ? 1 : 0], commonStart, ratios[mask & 4 ? 1 : 0],
    ));
}

export function releaseShapley(values) {
    assert.ok(values.length === 8 && values.every(Number.isFinite), "Release decomposition requires eight finite states");
    const contribution = bit => {
        let result = 0;
        for (let mask = 0; mask < 8; mask++) {
            if (mask & bit) continue;
            const count = (mask & 1 ? 1 : 0) + (mask & 2 ? 1 : 0) + (mask & 4 ? 1 : 0);
            result += (values[mask | bit] - values[mask]) * (count === 1 ? 1 / 6 : 1 / 3);
        }
        return result;
    };
    const quote = contribution(1), cpi = contribution(2), context = contribution(4);
    const change = values[7] - values[0];
    assert.ok(Math.abs(quote + cpi + context - change) < 1e-8, "Release decomposition does not reconcile");
    return { quote, cpi, context, change };
}

export function releaseDecomposition(market, reference) {
    const observed = releaseShapley(market), model = releaseShapley(reference);
    const loss = releaseShapley(market.map((value, mask) => (value - reference[mask]) ** 2));
    const before = market[0] - reference[0], after = market[7] - reference[7];
    const result = {
        before, after, change: after - before,
        quote: observed.quote, cpi: observed.cpi, context: observed.context,
        reference: -model.change,
        referenceQuote: -model.quote, referenceCpi: -model.cpi, referenceContext: -model.context,
        netQuote: observed.quote - model.quote,
        netCpi: observed.cpi - model.cpi,
        netContext: observed.context - model.context,
        fitQuoteImprovement: -loss.quote, fitCpiImprovement: -loss.cpi, fitContextImprovement: -loss.context,
        squaredImprovement: -loss.change,
    };
    assert.ok(Math.abs(result.quote + result.cpi + result.context + result.reference - result.change) < 1e-8,
        "Release residual does not reconcile");
    assert.ok(Math.abs(result.netQuote + result.netCpi + result.netContext - result.change) < 1e-8,
        "Recalibrated release residual does not reconcile");
    assert.ok(Math.abs(result.fitQuoteImprovement + result.fitCpiImprovement + result.fitContextImprovement
        - result.squaredImprovement) < 1e-8, "Release fit improvement does not reconcile");
    return result;
}
