import test from "node:test";
import assert from "node:assert/strict";
import { svenssonZero, zeroCcToBEY } from "../lib/zero/index.mjs";
import { buildBeiGrid } from "../node-calc-mktBei-grid.mjs";

const tipsCurve = { asOfDate: "2026-10-05T1235", basis: "Market-ask-settle-sa", settleDate: "2026-10-06", params: [0.02, -0.01, 0.01, 0.005, 2, 8] };
const nominalCurve = { asOfDate: "2026-10-05T1235", basis: "Market-ask-settle", settleDate: "2026-10-06", params: [0.045, -0.005, 0.01, 0.01, 2, 8] };

test("BEI grid reads both curves at 6-month points to 30 years and reports nominal minus TIPS", () => {
    const result = buildBeiGrid(tipsCurve, nominalCurve);
    assert.equal(result.asOfDate, tipsCurve.asOfDate);
    assert.equal(result.basis, "Market-ask-settle-sa");
    assert.equal(result.nominalBasis, "Market-ask-settle");
    assert.equal(result.settleDate, "2026-10-06");
    assert.equal(result.points.length, 60);
    assert.deepEqual([result.points[0].term, result.points[0].date], [0.5, "2027-04-06"]);
    assert.deepEqual([result.points[59].term, result.points[59].date], [30, "2056-10-06"]);
    for (const p of result.points) {
        const years = (new Date(p.date) - new Date(tipsCurve.settleDate)) / 86400000 / 365;
        const tips = svenssonZero(years, tipsCurve.params);
        const nominal = svenssonZero(years, nominalCurve.params);
        assert.ok(Math.abs(p.tipsZeroCc - tips) < 6e-6, `TIPS zero at ${p.term}`);
        assert.ok(Math.abs(p.nominalZeroCc - nominal) < 6e-6, `nominal zero at ${p.term}`);
        assert.ok(Math.abs(p.beiCc - (nominal - tips)) < 6e-6, `beiCc at ${p.term}`);
        assert.ok(Math.abs(p.beiBey - (zeroCcToBEY(nominal) - zeroCcToBEY(tips))) < 6e-6, `beiBey at ${p.term}`);
    }
});

test("BEI grid requires matching curve dates, asOfDates and Svensson params", () => {
    assert.throws(() => buildBeiGrid(tipsCurve, { ...nominalCurve, settleDate: "2026-11-01" }), /does not match the TIPS curve date/);
    assert.throws(() => buildBeiGrid(tipsCurve, { ...nominalCurve, asOfDate: "2026-10-06T1235" }), /asOfDate/);
    assert.throws(() => buildBeiGrid({ ...tipsCurve, params: [0.02] }, nominalCurve), /six Svensson params/);
});
