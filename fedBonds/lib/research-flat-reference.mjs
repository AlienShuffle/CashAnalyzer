import assert from "node:assert/strict";
import { couponSchedule, accruedInterest } from "../../mktBonds/lib/coupons.mjs";
import { daysBetween, normalizeDate } from "../../mktBonds/lib/dates.mjs";

function cashFlows(settle, bond) {
    const start = normalizeDate(settle), end = normalizeDate(bond.maturity);
    assert.ok(start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start,
        "Invalid flat-reference dates");
    assert.ok(Number.isFinite(bond.coupon) && bond.coupon >= 0, "Invalid flat-reference coupon");
    const schedule = couponSchedule(start, end);
    return schedule.map((date, index) => ({
        years: daysBetween(start, date) / 365,
        amount: 100 * (bond.coupon / 2 + (index === schedule.length - 1 ? 1 : 0)),
    }));
}

const presentValue = (flows, rate) => flows.reduce((sum, flow) => sum + flow.amount * Math.exp(-rate * flow.years), 0);

export function flatReferencePrice(settle, maturity, coupon, rate) {
    assert.ok(Number.isFinite(rate), "Invalid flat-reference rate");
    const price = presentValue(cashFlows(settle, { maturity, coupon }), rate) - accruedInterest(settle, maturity, coupon);
    assert.ok(Number.isFinite(price) && price > 0, "Invalid flat-reference clean price");
    return price;
}

export function fitNearestFlatReference(settle, bonds) {
    assert.ok(bonds.length >= 3, "Flat reference requires three training bonds");
    const nearest = [...bonds].sort((a, b) => a.maturity.localeCompare(b.maturity) || a.cusip.localeCompare(b.cusip)).slice(0, 3);
    assert.equal(new Set(nearest.map(row => row.cusip)).size, 3, "Duplicate flat-reference training bond");
    const prepared = nearest.map(bond => {
        assert.ok(Number.isFinite(bond.cleanPrice) && bond.cleanPrice > 0, "Invalid flat-reference training price");
        return { flows: cashFlows(settle, bond), dirty: bond.cleanPrice + accruedInterest(settle, bond.maturity, bond.coupon) };
    });
    const target = prepared.reduce((sum, bond) => sum + bond.dirty, 0);
    const pv = rate => prepared.reduce((sum, bond) => sum + presentValue(bond.flows, rate), 0);
    let low = -0.1, high = 0.1;
    for (let i = 0; pv(low) < target && i < 30; i++) low *= 2;
    for (let i = 0; pv(high) > target && i < 30; i++) high *= 2;
    assert.ok(pv(low) >= target && pv(high) <= target, "Cannot bracket flat-reference rate");
    for (let i = 0; i < 120; i++) {
        const middle = (low + high) / 2;
        if (pv(middle) > target) low = middle; else high = middle;
    }
    const rate = (low + high) / 2;
    assert.ok(Number.isFinite(rate) && Math.abs(pv(rate) - target) < 1e-8, "Flat-reference calibration did not converge");
    return {
        rate, trainingCusips: nearest.map(bond => bond.cusip),
        trainingMinimum: nearest[0].maturity, trainingMaximum: nearest.at(-1).maturity,
        trainingPriceRmse: Math.sqrt(nearest.reduce((sum, bond) =>
            sum + (flatReferencePrice(settle, bond.maturity, bond.coupon, rate) - bond.cleanPrice) ** 2, 0) / 3),
    };
}
