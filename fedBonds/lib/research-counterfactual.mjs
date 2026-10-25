import assert from "node:assert/strict";
import { daysBetween, daysInYearFrom, normalizeDate } from "../../mktBonds/lib/dates.mjs";
import { forwardTipsCleanPrice } from "../../mktBonds/lib/forwards/index.mjs";
import { originalSettlementPrice } from "./research-pricing.mjs";
import { mean } from "./research-experiment.mjs";

export function trendCarryPath(row, trend, getRefCpi) {
    const settle = normalizeDate(row.settle_date), horizon = normalizeDate(row.fwd_date);
    const years = daysBetween(settle, horizon) / 365;
    assert.ok(years > 0 && Number.isFinite(trend), "Invalid counterfactual trend or horizon");
    assert.ok(row.settle_refcpi > 0 && row.fwd_refcpi > 0, "Invalid counterfactual CPI");
    const actualCarry = Math.log(row.fwd_refcpi / row.settle_refcpi) / years;
    const tilt = trend - actualCarry;
    return {
        actualCarry, tilt,
        getRefCpi(date) {
            const day = normalizeDate(date);
            assert.ok(day >= settle && day <= horizon, "Counterfactual CPI requested outside known carry window");
            const value = getRefCpi(day);
            assert.ok(Number.isFinite(value) && value > 0, "Missing counterfactual CPI input");
            return value * Math.exp(tilt * daysBetween(settle, day) / 365);
        },
    };
}

export function repriceCarryRow(row, getRefCpi) {
    const settleRefCpi = getRefCpi(normalizeDate(row.settle_date));
    const forwardRefCpi = getRefCpi(normalizeDate(row.fwd_date));
    assert.ok(Math.abs(settleRefCpi - row.settle_refcpi) < 1e-8, "Counterfactual must anchor CPI at settlement");
    const price = forwardTipsCleanPrice({
        settle: row.settle_date, forward: row.fwd_date, maturity: row.maturity_date,
        coupon: row.interest_rate, price: row.settle_clean_price, datedRefCpi: row.dated_refcpi,
        settleRefCpi, forwardRefCpi, repoRate: row.repo_rate, getRefCpi,
    });
    assert.ok(Number.isFinite(price) && price > 0, "Invalid counterfactual forward price");
    // The common proportional tilt to NSA and SA leaves all seasonal factors unchanged.
    return { ...row, settle_refcpi: settleRefCpi, fwd_refcpi: forwardRefCpi, fwd_clean_price: price };
}

export function transformedPrice(row, { valuation, adjustment }) {
    assert.ok(["settle", "forward"].includes(valuation) && ["none", "sa", "sa-decay"].includes(adjustment),
        "Invalid counterfactual variant");
    const forward = valuation === "forward";
    const ratio = adjustment === "none" ? 1
        : row[`${forward ? "fwd" : "settle"}_mature_sa_ratio${adjustment === "sa-decay" ? "_decay" : ""}`];
    const slope = forward ? row.settle_refcpi / row.fwd_refcpi
        * (1 + row.repo_rate * daysBetween(normalizeDate(row.settle_date), normalizeDate(row.fwd_date))
            / daysInYearFrom(normalizeDate(row.settle_date))) : 1;
    assert.ok(Number.isFinite(ratio) && ratio > 0 && Number.isFinite(slope) && slope > 0, "Invalid counterfactual transform");
    return { clean: (forward ? row.fwd_clean_price : row.settle_clean_price) * ratio, slope: slope * ratio };
}

export function fixedReferencePrediction(actual, counterfactual, variant, actualPrediction) {
    const transform = transformedPrice(actual, variant);
    const model = transform.clean + (actualPrediction - actual.settle_clean_price) * transform.slope;
    assert.ok(Math.abs(originalSettlementPrice(actual, variant, model) - actualPrediction) < 1e-8,
        "Fixed reference recovery failed");
    return originalSettlementPrice(counterfactual, variant, model);
}

export function displacement(actualError, counterfactualError) {
    assert.ok(Number.isFinite(actualError) && Number.isFinite(counterfactualError), "Nonfinite counterfactual displacement");
    return {
        improvement: actualError ** 2 - counterfactualError ** 2,
        toward: Math.abs(counterfactualError) < Math.abs(actualError) ? 1 : 0,
        through: actualError * counterfactualError < 0 ? 1 : 0,
    };
}

export function pairedMeanInterval(episodes, field, iterations = 2000) {
    const values = episodes.map(row => row[field]);
    assert.ok(values.length && values.every(Number.isFinite), "Invalid counterfactual bootstrap input");
    let seed = 1729;
    const estimates = [];
    for (let i = 0; i < iterations; i++) {
        let sum = 0;
        for (let j = 0; j < values.length; j++) {
            seed = (1664525 * seed + 1013904223) >>> 0;
            sum += values[Math.floor(seed / 4294967296 * values.length)];
        }
        estimates.push(sum / values.length);
    }
    estimates.sort((a, b) => a - b);
    return {
        mean: mean(values),
        lower95: estimates[Math.floor((estimates.length - 1) * 0.025)],
        upper95: estimates[Math.ceil((estimates.length - 1) * 0.975)],
    };
}
