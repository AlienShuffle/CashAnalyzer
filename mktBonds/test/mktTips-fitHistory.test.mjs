import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildFitHistory, curveFitStats, loadArchivedCurves, parseOptions } from "../node-calc-mktTips-fitHistory.mjs";

const params = [0.02, -0.01, 0.01, 0.005, 2, 8];

function curve(residuals, objective) {
    return {
        settleDate: "2026-10-08", objective, params,
        rows: residuals.map(([maturity, residualBp]) => ({ maturity, residualBp })),
    };
}

const saCurve = curve([["2027-01-15", 4], ["2027-04-15", -6], ["2028-01-15", 2], ["2035-07-15", 3], ["2050-02-15", -1]], 0.2);
const decayCurve = curve([["2027-01-15", 2], ["2027-04-15", -2], ["2028-01-15", 1], ["2035-07-15", 3], ["2050-02-15", -1]], 0.15);

test("curve fit statistics split short and long bonds and measure the maturity-month pattern", () => {
    const stats = curveFitStats(saCurve, { shortYears: 3 });
    assert.equal(stats.bonds, 5);
    assert.equal(stats.shortBonds, 3);
    assert.equal(stats.rmsBp, Math.round(Math.sqrt((16 + 36 + 4 + 9 + 1) / 5) * 1000) / 1000);
    assert.equal(stats.shortRmsBp, Math.round(Math.sqrt((16 + 36 + 4) / 3) * 1000) / 1000);
    assert.equal(stats.maxAbsBp, 6);
    // January mean (4 + 2) / 2 = 3 against April -6.
    assert.equal(stats.monthRangeBp, 9);
    assert.ok(stats.zero1y > 0 && stats.zero2y > 0);
});

test("fit history compares sa-decay with sa and holds back a verdict until there is enough history", () => {
    const groups = ["2026-10-06T1705", "2026-10-07T0805", "2026-10-08T1235"].map(asOfDate => ({
        asOfDate, side: "ask", valuation: "forward", fits: { sa: saCurve, "sa-decay": decayCurve },
    }));
    const result = buildFitHistory(groups, { minDays: 3 });
    assert.equal(result.rows.length, 6);
    const [summary] = result.summary;
    assert.deepEqual([summary.side, summary.valuation, summary.snapshots, summary.days, summary.decayWins], ["ask", "forward", 3, 3, 3]);
    assert.equal(summary.objectiveChangePct, -25);
    assert.equal(summary.longRmsDeltaBp, 0);
    assert.ok(summary.shortRmsDeltaBp < 0 && summary.monthRangeDeltaBp < 0);
    assert.equal(summary.zero1yMeanAbsDiffBp, 0);
    assert.equal(summary.verdict, "sa-decay better");
    assert.equal(buildFitHistory(groups, { minDays: 4 }).summary[0].verdict, "insufficient history");
    const flipped = groups.map(g => ({ ...g, fits: { sa: decayCurve, "sa-decay": saCurve } }));
    assert.equal(buildFitHistory(flipped, { minDays: 3 }).summary[0].verdict, "sa better");
    const sameDay = groups.map(g => ({ ...g, asOfDate: `2026-10-08T${g.asOfDate.slice(11)}` }));
    const sameDaySummary = buildFitHistory(sameDay, { minDays: 3 }).summary[0];
    assert.deepEqual([sameDaySummary.snapshots, sameDaySummary.days, sameDaySummary.verdict], [3, 1, "insufficient history"]);
    const shorter = { ...decayCurve, rows: decayCurve.rows.slice(1) };
    assert.equal(buildFitHistory([{ ...groups[0], fits: { sa: saCurve, "sa-decay": shorter } }]).summary.length, 0);
});

test("archived curves are grouped by snapshot, side and valuation; other files are ignored", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fitHistory-"));
    try {
        const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
        write("2026-10-08T1235-mktTips-curve-fwd-sa-ask.json", saCurve);
        write("2026-10-08T1235-mktTips-curve-fwd-sa-decay-ask.json", decayCurve);
        write("2026-10-08T1235-mktTips-curve-bid.json", saCurve);
        write("2026-10-08T1235-mktNominal-grid-ask.json", {});
        write("2026-10-08T1235-mktBei-grid-sa-ask.json", {});
        const groups = loadArchivedCurves(dir);
        assert.equal(groups.length, 2);
        const forward = groups.find(g => g.valuation === "forward");
        assert.deepEqual(Object.keys(forward.fits).sort(), ["sa", "sa-decay"]);
        assert.deepEqual(Object.keys(groups.find(g => g.side === "bid").fits), ["none"]);
    } finally {
        fs.rmSync(dir, { recursive: true });
    }
});

test("fit history options are validated", () => {
    assert.deepEqual(parseOptions(["--daily=/x", "--shortYears=2", "--minDays=5"]), { daily: "/x", shortYears: 2, minDays: 5 });
    assert.throws(() => parseOptions([]), /--daily/);
    assert.throws(() => parseOptions(["--daily=/x", "--minDays=0"]), /minDays/);
    assert.throws(() => parseOptions(["--bogus=1"]), /Unknown option/);
});
