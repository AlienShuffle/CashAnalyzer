import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { variants, parseOptions, historyPeriods, loadArchivedGrids, buildBeiHistory, historyCsv,
    publishBeiHistory } from "../report-bei-history.mjs";

const grid = (date, variant) => ({
    asOfDate: date, basis: `FedInvest-${variant}`, nominalBasis: "FedInvest-ask-settle", settleDate: date,
    method: "Svensson", points: [{ term: 0.5, date: "2027-05-04", tipsZeroCc: 0.01, tipsZeroBey: 0.011,
        nominalZeroCc: 0.04, nominalZeroBey: 0.041, beiCc: 0.03, beiBey: 0.03 }],
});

function fixture(t, archivedDates) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "fed-bei-history-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const history = path.join(home, "history"), daily = path.join(home, "daily");
    fs.mkdirSync(daily, { recursive: true });
    fs.mkdirSync(history);
    const archive = date => {
        for (const variant of variants) {
            fs.writeFileSync(path.join(daily, `${date}-fedBei-grid-${variant}.json`), JSON.stringify(grid(date, variant)));
        }
    };
    for (const variant of variants) {
        fs.writeFileSync(path.join(history, `fedBei-grid-${variant}-rate-new.json`), JSON.stringify(grid("2026-11-04", variant)));
    }
    archivedDates.forEach(archive);
    return { home, history, daily, archive };
}

test("look-back periods use trading days and roll non-trading calendar targets back", () => {
    const periods = Object.fromEntries(historyPeriods("2026-11-04").map(p => [p.period, p]));
    assert.deepEqual(Object.keys(periods), ["current", "previousTradingDay", "30d", "90d", "180d", "1y"]);
    assert.deepEqual(periods.current.candidates, ["2026-11-04"]);
    assert.equal(periods.previousTradingDay.candidates[0], "2026-11-03");
    // 2026-10-05 is a Monday; 2026-10-12 (Columbus Day) is closed.
    assert.equal(periods["30d"].candidates[0], "2026-10-05");
    assert.deepEqual(historyPeriods("2026-11-11").find(p => p.period === "30d").candidates.slice(0, 2), ["2026-10-09", "2026-10-08"]);
    assert.equal(historyPeriods("2026-11-10").find(p => p.period === "previousTradingDay").candidates[0], "2026-11-09");
    assert.equal(historyPeriods("2026-11-12").find(p => p.period === "previousTradingDay").candidates[0], "2026-11-10");
    // Saturday 2025-11-08 rolls back to Friday; leap day clamps to February 28.
    assert.equal(historyPeriods("2026-11-09").find(p => p.period === "1y").candidates[0], "2025-11-07");
    assert.equal(historyPeriods("2028-02-29").find(p => p.period === "1y").targetDate, "2027-02-28");
    assert.equal(periods["1y"].candidates.length, 4);
    assert.throws(() => historyPeriods("2026-02-30"), /Invalid date/);
});

test("options validate the anchor date and reject unknown flags", () => {
    assert.equal(parseOptions(["--date=2026-11-04", "--no-backfill"]).date, "2026-11-04");
    assert.equal(parseOptions(["--no-backfill"]).backfill, false);
    assert.equal(parseOptions(["--published=/tmp/x"]).published, "/tmp/x");
    for (const args of [["--date=2026-02-30"], ["--unknown"], ["--published="], ["--daily=/tmp"]]) {
        assert.throws(() => parseOptions(args));
    }
});

test("archived grids require every variant and a matching asOfDate", t => {
    const { daily } = fixture(t, ["2026-11-03"]);
    assert.equal(Object.keys(loadArchivedGrids(daily, "2026-11-03")).length, 12);
    assert.equal(loadArchivedGrids(daily, "2026-11-02"), null);
    fs.writeFileSync(path.join(daily, "2026-11-03T1405-fedBei-grid-ask.json"), JSON.stringify(grid("2026-10-01", "ask")));
    assert.throws(() => loadArchivedGrids(daily, "2026-11-03"), /Invalid archived/);
    fs.unlinkSync(path.join(daily, "2026-11-03T1405-fedBei-grid-ask.json"));
    fs.unlinkSync(path.join(daily, "2026-11-03-fedBei-grid-bid.json"));
    assert.equal(loadArchivedGrids(daily, "2026-11-03"), null);
});

test("history uses archives, backfills missing dates, falls back to earlier days and records gaps", t => {
    const { home, history, daily, archive } = fixture(t, ["2026-11-03", "2026-08-06"]);
    const attempts = [], warnings = [];
    const reports = buildBeiHistory({
        history, daily, log: message => warnings.push(message),
        backfill: date => {
            attempts.push(date);
            if (date === "2026-10-05") throw new Error("FedInvest has no prices");
            if (["2026-10-02", "2026-05-08"].includes(date)) archive(date);
            else if (date.startsWith("2025-")) throw new Error(`unavailable ${date}`);
        },
    });
    assert.deepEqual(attempts, ["2026-10-05", "2026-10-02", "2026-05-08",
        "2025-11-04", "2025-11-03", "2025-10-31", "2025-10-30"]);
    assert.deepEqual(Object.keys(reports), variants);
    const report = reports["sa-decay-bid"];
    assert.equal(report.asOfDate, "2026-11-04");
    assert.deepEqual(report.periods.map(p => [p.period, p.targetDate, p.asOfDate]), [
        ["current", "2026-11-04", "2026-11-04"], ["previousTradingDay", "2026-11-03", "2026-11-03"],
        ["30d", "2026-10-05", "2026-10-02"], ["90d", "2026-08-06", "2026-08-06"], ["180d", "2026-05-08", "2026-05-08"],
    ]);
    assert.ok(report.periods.every(p => p.basis === "FedInvest-sa-decay-bid"));
    assert.deepEqual(report.missing.map(m => m.period), ["1y"]);
    assert.match(warnings.join("\n"), /1y \(2025-11-04\) unavailable: 2025-11-04: unavailable 2025-11-04;/);

    const csv = historyCsv(report).trim().split("\n");
    assert.equal(csv[0], "period, targetDate, asOfDate, basis, nominalBasis, curveDate, term, date, tipsZeroCc, tipsZeroBey, nominalZeroCc, nominalZeroBey, beiCc, beiBey");
    assert.equal(csv[3], '"30d","2026-10-05","2026-10-02","FedInvest-sa-decay-bid","FedInvest-ask-settle","2026-10-02",0.5,"2027-05-04",0.01,0.011,0.04,0.041,0.03,0.03');
    assert.equal(csv.length, 6);

    const published = path.join(home, "published");
    fs.mkdirSync(published);
    fs.writeFileSync(path.join(published, "fedBei-grid-ask-rate.csv"), "x");
    publishBeiHistory(reports, published);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(published, "fedBei-history-ask-rate.json"), "utf8")), reports.ask);
    const manifest = fs.readFileSync(path.join(published, "fedBei-manifest.txt"), "utf8").trim().split("\n");
    assert.equal(manifest.length, 13);
    assert.equal(manifest[0], "fedBei-grid-ask-rate.csv");
    const before = fs.statSync(path.join(published, "fedBei-history-ask-rate.csv")).mtimeMs;
    publishBeiHistory(reports, published);
    assert.equal(fs.statSync(path.join(published, "fedBei-history-ask-rate.csv")).mtimeMs, before);
});

test("an explicit anchor date reads the current period from the archive and no-backfill reports gaps", t => {
    const { history, daily } = fixture(t, ["2026-10-02"]);
    const reports = buildBeiHistory({ date: "2026-10-02", history, daily, backfill: false, log: () => {} });
    assert.equal(reports.ask.asOfDate, "2026-10-02");
    assert.deepEqual(reports.ask.periods.map(p => p.period), ["current"]);
    assert.equal(reports.ask.missing.length, 5);
    assert.match(reports.ask.missing[0].error, /not archived/);
});
