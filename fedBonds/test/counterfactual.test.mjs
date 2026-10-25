import test from "node:test";
import assert from "node:assert/strict";
import { trendCarryPath, repriceCarryRow, transformedPrice, fixedReferencePrediction, displacement,
    pairedMeanInterval } from "../lib/research-counterfactual.mjs";
import { originalSettlementPrice } from "../lib/research-pricing.mjs";
import { daysBetween, normalizeDate } from "../../mktBonds/lib/dates.mjs";

const iso = date => {
    const day = normalizeDate(date);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
};

function fixture(settle = "2025-01-10", forward = "2025-03-01") {
    const getRefCpi = date => 300 * Math.exp(0.04 * daysBetween(normalizeDate(settle), normalizeDate(date)) / 365);
    const row = {
        settle_date: settle, fwd_date: forward, maturity_date: "2026-01-15",
        settle_clean_price: 99.5, dated_refcpi: 280, settle_refcpi: 300,
        fwd_refcpi: getRefCpi(forward), interest_rate: 0.02, repo_rate: 0.045,
        settle_mature_sa_ratio: 1.002, settle_mature_sa_ratio_decay: 1.001,
        fwd_mature_sa_ratio: 1.003, fwd_mature_sa_ratio_decay: 1.0015,
    };
    return { row: repriceCarryRow(row, getRefCpi), getRefCpi };
}

test("trend path anchors settlement, hits NSA trend, and zero gap preserves daily CPI", () => {
    const { row, getRefCpi } = fixture();
    const path = trendCarryPath(row, 0.02, getRefCpi);
    assert.equal(path.getRefCpi(row.settle_date), row.settle_refcpi);
    const carry = Math.log(path.getRefCpi(row.fwd_date) / row.settle_refcpi)
        / ((Date.parse(row.fwd_date) - Date.parse(row.settle_date)) / 86400000 / 365);
    assert.ok(Math.abs(carry - 0.02) < 1e-12);
    const identity = trendCarryPath(row, path.actualCarry, getRefCpi);
    for (const date of [row.settle_date, "2025-01-15", row.fwd_date]) {
        assert.equal(identity.getRefCpi(date), getRefCpi(date));
    }
    assert.throws(() => path.getRefCpi("2025-03-02"), /outside/);
    assert.throws(() => trendCarryPath(row, NaN, getRefCpi), /Invalid/);
    assert.throws(() => trendCarryPath(row, 0.02, () => null).getRefCpi(row.fwd_date), /Missing/);
});

test("carry recomputation handles intervening and endpoint coupons and preserves all six round trips", () => {
    for (const forward of ["2025-01-15", "2025-03-01"]) {
        const { row, getRefCpi } = fixture("2025-01-10", forward);
        const snapshot = structuredClone(row);
        const dates = [];
        const path = trendCarryPath(row, -0.01, date => {
            dates.push(iso(date));
            return getRefCpi(date);
        });
        const cf = repriceCarryRow(row, path.getRefCpi);
        assert.deepEqual(dates, forward === "2025-01-15"
            ? ["2025-01-10", forward] : ["2025-01-10", forward, "2025-01-15"]);
        assert.deepEqual(row, snapshot);
        assert.equal(cf.settle_clean_price, row.settle_clean_price);
        assert.equal(cf.repo_rate, row.repo_rate);
        for (const valuation of ["settle", "forward"]) for (const adjustment of ["none", "sa", "sa-decay"]) {
            const variant = { valuation, adjustment };
            assert.ok(Math.abs(originalSettlementPrice(cf, variant, transformedPrice(cf, variant).clean) - row.settle_clean_price) < 1e-10);
            const modelPrice = row.settle_clean_price - 0.2;
            assert.ok(Math.abs(fixedReferencePrediction(row, row, variant, modelPrice) - modelPrice) < 1e-10);
            const zeroGap = repriceCarryRow(row, trendCarryPath(row, path.actualCarry, getRefCpi).getRefCpi);
            assert.deepEqual(zeroGap, row);
            assert.ok(Math.abs(fixedReferencePrediction(row, zeroGap, variant, modelPrice) - modelPrice) < 1e-10);
            if (valuation === "settle") assert.equal(fixedReferencePrediction(row, cf, variant, modelPrice), modelPrice);
        }
        assert.deepEqual(repriceCarryRow(row, getRefCpi), row);
        assert.equal(cf.fwd_mature_sa_ratio, row.fwd_mature_sa_ratio);
        assert.equal(cf.fwd_mature_sa_ratio_decay, row.fwd_mature_sa_ratio_decay);
        // Without the intervening coupon adjustment the forward price differs measurably.
        if (forward === "2025-03-01") {
            const wrong = repriceCarryRow(row, date =>
                iso(date) === "2025-01-15" ? getRefCpi(date) : path.getRefCpi(date));
            assert.ok(Math.abs(wrong.fwd_clean_price - cf.fwd_clean_price) > 1e-6);
        }
    }
});

test("displacement distinguishes movement toward, through and away; paired intervals are deterministic", () => {
    assert.deepEqual(displacement(2, -1), { improvement: 3, toward: 1, through: 1 });
    assert.deepEqual(displacement(2, -3), { improvement: -5, toward: 0, through: 1 });
    assert.deepEqual(displacement(-1, -2), { improvement: -3, toward: 0, through: 0 });
    assert.deepEqual(displacement(0, 0), { improvement: 0, toward: 0, through: 0 });
    const episodes = [1, 2, 3].map(value => ({ value }));
    const ci = pairedMeanInterval(episodes, "value", 100);
    assert.equal(ci.mean, 2);
    assert.ok(ci.lower95 <= 2 && ci.upper95 >= 2);
    assert.deepEqual(ci, pairedMeanInterval(episodes, "value", 100));
    assert.throws(() => pairedMeanInterval([], "value"), /Invalid/);
});
