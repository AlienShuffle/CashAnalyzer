import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { toPublishedRows } from "../node-fedBonds-update.mjs";
import { buildNominalRows } from "../../mktBonds/node-mktNominals-update.mjs";
import { buildTipsRows, parseOptions } from "../../mktBonds/node-mktTips-update.mjs";
import { loadArchivedCurves } from "../../mktBonds/node-calc-mktTips-fitHistory.mjs";
import { loadSnapshots } from "../../mktBonds/node-calc-mktBei-stability.mjs";
import { tipsZeroModelPrice } from "../../mktBonds/lib/zero/index.mjs";
import { accruedInterest } from "../../mktBonds/lib/coupons.mjs";
import { tbillRepoRate, forwardNominalCleanPrice, forwardTipsCleanPrice } from "../../mktBonds/lib/forwards/index.mjs";
import { roundYield } from "../../mktBonds/lib/rounding.mjs";
import { yieldFromPrice } from "../../mktBonds/lib/yield.mjs";
import { parseOptions as parseHistoryOptions } from "../report-history.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const record = {
    asOfDate: "2026-10-02", cusip: "912828YQ7", securitytype: "MARKET BASED NOTE",
    rate: "0.01625", maturitydate: "2030-10-31", buy: "99.123456", sell: "99.062500",
    endofday: "0.00000", calldate: "",
};

test("historical command validates dates and mutually exclusive quote sources", () => {
    assert.deepEqual(parseHistoryOptions(["2026-10-01"]), { date: "2026-10-01", input: null, fetch: false });
    assert.equal(parseHistoryOptions(["2026-10-01", "--fetch"]).fetch, true);
    for (const args of [[], ["2026-02-30"], ["2026-10-01", "--unknown"], ["2026-10-01", "--input="],
        ["2026-10-01", "--fetch", "--input=quotes.json"]]) {
        assert.throws(() => parseHistoryOptions(args));
    }
});

test("FedInvest adapter preserves decimal coupons, date-only dates and agency quote sides", () => {
    const [row] = toPublishedRows([record]);
    assert.deepEqual(Object.keys(row), [
        "asOfDate", "cusip", "securitytype", "interest_rate", "maturity_date", "bid", "ask", "description",
    ]);
    assert.equal(row.interest_rate, 0.01625);
    assert.equal(row.asOfDate, "2026-10-02");
    assert.equal(row.maturity_date, record.maturitydate);
    assert.equal(row.bid, 99.0625);
    assert.equal(row.ask, 99.123456);
    assert.equal(row.securitytype, "Bond");
    for (const [securitytype, expected] of [
        ["MARKET BASED BILL", "Bill"], ["MARKET BASED BOND", "Bond"], ["TIPS", "TIPS"], ["MARKET BASED FRN", "FRN"],
    ]) {
        const [mapped] = toPublishedRows([{ ...record, securitytype, buy: "0.000000", sell: "" }]);
        assert.equal(mapped.securitytype, expected);
        assert.equal(mapped.ask, "");
        assert.equal(mapped.bid, "");
    }
});

test("FedInvest adapter rejects invalid input rather than publishing misleading prices", () => {
    for (const input of [[], {}, null]) assert.throws(() => toPublishedRows(input), /non-empty array/);
    for (const change of [
        { rate: "NaN" }, { rate: "" }, { buy: "-1" }, { sell: "bad" },
        { asOfDate: "2026-02-30" }, { maturitydate: "invalid" },
        { securitytype: "UNKNOWN" }, { cusip: "" },
    ]) assert.throws(() => toPublishedRows([{ ...record, ...change }]), /Invalid|Unsupported/);
    assert.throws(() => toPublishedRows([record, record]), /duplicate/);
    assert.throws(() => toPublishedRows([record, { ...record, cusip: "912828YQ8", asOfDate: "2026-10-01" }]), /common asOfDate/);
});

test("FedInvest attribution reaches nominal and TIPS reports without changing Market defaults", () => {
    assert.equal(parseOptions("--reportSource=FedInvest").reportSource, "FedInvest");
    assert.equal(parseOptions().reportSource, "Market");
    assert.throws(() => parseOptions("--reportSource="), /reportSource/);
    const quotes = toPublishedRows([record, { ...record, cusip: "912828YQ8", securitytype: "MARKET BASED FRN" }]);
    const rows = buildNominalRows(quotes, "2026-11-01", { repoRate: 0.04, reportSource: "FedInvest" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].report_source, "FedInvest ask");
    const tips = [{ ...record, cusip: "912828YQ9", securitytype: "TIPS" }];
    const meta = [{ cusip: tips[0].cusip, maturity_date: record.maturitydate, interest_rate: 0.01625,
        dated_date: "2020-10-31", ref_cpi_on_dated_date: 300, security_term: 10, series: "X" }];
    const table = { maxDate: new Date(2026, 10, 1), getRefCpi: () => 330, getFactor: () => 1 };
    const [tip] = buildTipsRows(meta, toPublishedRows(tips), table, {
        repoRate: 0.04, priceSide: "bid", reportSource: "FedInvest",
    });
    assert.equal(tip.report_source, "FedInvest bid");
    assert.equal(tip.settle_clean_price, 99.0625);
});

test("T+0 drives both sides' financing, CPI, yields and forward prices; T+1 remains the default", () => {
    assert.equal(parseOptions().settlementDays, 1);
    assert.equal(parseOptions("--settlementDays=0").settlementDays, 0);
    for (const value of ["", "-1", "2", "NaN"]) {
        assert.throws(() => parseOptions(`--settlementDays=${value}`), /settlementDays/);
    }
    const tipsRecord = { ...record, cusip: "T00000000", securitytype: "TIPS" };
    const bills = ["2026-10-29", "2026-11-03"].map((maturitydate, i) => ({
        ...record, cusip: `B0000000${i}`, securitytype: "MARKET BASED BILL",
        maturitydate, rate: "0", buy: i ? "99.7" : "99.75", sell: i ? "99.65" : "99.7",
    }));
    const quotes = toPublishedRows([record, tipsRecord, ...bills]);
    const meta = [{ cusip: tipsRecord.cusip, maturity_date: record.maturitydate,
        interest_rate: 0.01625, dated_date: "2020-10-31", ref_cpi_on_dated_date: 300,
        security_term: 10, series: "X" }];
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const table = {
        maxDate: new Date(2026, 10, 1),
        getRefCpi: date => iso(date) === record.asOfDate ? 330 : 331,
        getFactor: date => iso(date) === record.asOfDate ? 1.001 : 1,
    };
    for (const priceSide of ["ask", "bid"]) {
        const options = { priceSide, repoRate: "auto", settlementDays: 0, reportSource: "FedInvest" };
        const [nominal] = buildNominalRows(quotes, "2026-11-01", options);
        const [tip] = buildTipsRows(meta, quotes, table, options);
        const repo = roundYield(tbillRepoRate(record.asOfDate, table.maxDate, quotes
            .filter(q => q.securitytype === "Bill")
            .map(q => ({ maturity: q.maturity_date, price: q[priceSide] }))).rate);
        for (const row of [nominal, tip]) {
            assert.equal(row.settle_date, record.asOfDate);
            assert.equal(row.repo_rate, repo);
            assert.equal(row.settle_ytm, yieldFromPrice(record.asOfDate, row.maturity_date,
                row.interest_rate, row.settle_clean_price));
        }
        assert.equal(tip.settle_refcpi, 330);
        assert.equal(tip.settle_mature_sa_ratio, 1.001);
        assert.equal(tip.fwd_refcpi, 331);
        assert.equal(nominal.fwd_clean_price, forwardNominalCleanPrice({
            settle: record.asOfDate, forward: table.maxDate, maturity: nominal.maturity_date,
            coupon: nominal.interest_rate, price: nominal.settle_clean_price, repoRate: repo,
        }));
        assert.equal(tip.fwd_clean_price, forwardTipsCleanPrice({
            settle: record.asOfDate, forward: table.maxDate, maturity: tip.maturity_date,
            coupon: tip.interest_rate, price: tip.settle_clean_price, repoRate: repo,
            datedRefCpi: 300, settleRefCpi: 330, forwardRefCpi: 331, getRefCpi: table.getRefCpi,
        }));
        const marketOptions = { repoRate: "auto", priceSide };
        const [marketNominal] = buildNominalRows(quotes, "2026-11-01", marketOptions);
        const [marketTip] = buildTipsRows(meta, quotes, table, marketOptions);
        assert.equal(marketNominal.settle_date, "2026-10-05");
        assert.equal(marketTip.settle_date, "2026-10-05");
        assert.equal(marketTip.settle_refcpi, 331);
        assert.notEqual(nominal.repo_rate, marketNominal.repo_rate);
        assert.notEqual(tip.fwd_clean_price, marketTip.fwd_clean_price);
    }
    assert.throws(() => buildNominalRows(quotes, "2026-11-01", { settlementDays: 2 }), /settlementDays/);
    assert.throws(() => buildTipsRows(meta, quotes, table, { settlementDays: 2 }), /settlementDays/);
});

test("parallel job publishes every Fed family, daily archive, summary and manifest in isolation", t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "fedBonds-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const repo = path.join(home, "CashAnalyzer");
    const cwd = path.join(repo, "fedBonds");
    const cloud = path.join(home, "cloudflare/public/Treasuries");
    fs.mkdirSync(path.join(cwd, "history"), { recursive: true });
    fs.mkdirSync(path.join(repo, "FedInvest/history"), { recursive: true });
    fs.mkdirSync(path.join(cloud, "mktBonds"), { recursive: true });
    fs.writeFileSync(path.join(cloud, "mktBonds/sentinel"), "unchanged");
    for (const name of ["bin", "lib"]) fs.symlinkSync(path.join(root, name), path.join(repo, name));
    fs.mkdirSync(path.join(repo, "mktBonds"));
    fs.symlinkSync(path.join(root, "mktBonds/lib"), path.join(repo, "mktBonds/lib"));
    for (const name of fs.readdirSync(path.join(root, "mktBonds")).filter(name => /\.(mjs|sh)$/.test(name))) {
        fs.copyFileSync(path.join(root, "mktBonds", name), path.join(repo, "mktBonds", name));
    }
    fs.mkdirSync(path.join(cwd, "lib"));
    fs.copyFileSync(path.join(root, "fedBonds/lib/daily-archive.mjs"), path.join(cwd, "lib/daily-archive.mjs"));
    for (const name of ["job-fedBonds-update.sh", "collect-fedBonds.sh", "node-fedBonds-update.mjs", "report-history.mjs", "publish-daily.mjs"]) {
        fs.copyFileSync(path.join(root, "fedBonds", name), path.join(cwd, name));
    }
    fs.writeFileSync(path.join(repo, "meta.common.sh"), 'cloudFlareHome="$HOME/cloudflare/public"\n');

    const input = [];
    const meta = ["cusip,interest_rate,security_term,series,maturity_date,dated_date,ref_cpi_on_dated_date"];
    for (const [prefix, type, coupon, params] of [
        ["N", "MARKET BASED NOTE", 0.04, [0.04, -0.005, 0.01, 0.005, 2, 8]],
        ["T", "TIPS", 0.02, [0.02, -0.01, 0.01, 0.005, 2, 8]],
    ]) {
        for (const [i, year] of [2027, 2028, 2029, 2030, 2032, 2035, 2040, 2045, 2050, 2055].entries()) {
            const maturity = `${year}-07-15`;
            const clean = tipsZeroModelPrice(record.asOfDate, maturity, coupon, params)
                - accruedInterest(record.asOfDate, maturity, coupon);
            const cusip = `${prefix}${String(i).padStart(8, "0")}`;
            input.push({ ...record, cusip, securitytype: type, rate: String(coupon), maturitydate: maturity,
                buy: String(clean + 0.01), sell: String(clean) });
            if (type === "TIPS") meta.push(`${cusip},${coupon},10,X,${maturity},2020-07-15,330`);
        }
    }
    for (const [i, maturity] of ["2026-10-29", "2026-11-03"].entries()) {
        input.push({ ...record, cusip: `B${String(i).padStart(8, "0")}`, securitytype: "MARKET BASED BILL",
            rate: "0", maturitydate: maturity, buy: i ? "99.7" : "99.75", sell: i ? "99.65" : "99.7" });
    }
    input.push({ ...record, cusip: "F00000000", securitytype: "MARKET BASED FRN" });
    const inputFile = path.join(repo, "FedInvest/history/FedInvest-rate-new.json");
    fs.writeFileSync(inputFile, JSON.stringify(input));
    fs.writeFileSync(path.join(cloud, "TIPSmeta.csv"), meta.join("\n"));

    const cpi = ["Date,REFCPINSA,REFCPISA,SAFactor,MMDD,maxREFCPI"];
    for (let date = new Date("2025-11-01"); date <= new Date("2026-11-01"); date.setUTCDate(date.getUTCDate() + 1)) {
        cpi.push(`${date.toISOString().slice(0, 10)},330,330,1,,2026-11-01`);
    }
    const holidays = Array.from({ length: 12 }, (_, i) =>
        `[\\"$\\",\\"h3\\",null,{\\"children\\":\\"New Year ${2010 + i}\\"}],[\\"$\\",\\"span\\",null,{\\"children\\":\\"Friday, January 1, ${2010 + i}\\"}],`
    ).join("");
    const mock = path.join(home, "fetch.mjs");
    fs.writeFileSync(mock, `
globalThis.fetch = async url => {
    if (String(url).endsWith("/REFCPI.csv")) return new Response(${JSON.stringify(cpi.join("\n"))});
    if (String(url).includes("sifma.org/")) return new Response(${JSON.stringify(holidays)});
    throw new Error("Unexpected network request: " + url);
};
`);
    const errFile = path.join(home, "job-errors.log");
    fs.writeFileSync(path.join(cwd, "history/fedBei-stability-cache.json"),
        JSON.stringify({ key: "shortYears=3;v2", entries: { "2026-10-02|ask|sa|settle": "obsolete T+1" } }));
    const run = (job = "./job-fedBonds-update.sh", workDir = cwd, env = {}) => {
        fs.writeFileSync(errFile, "");
        const result = spawnSync("bash", [job, "-f"], {
            cwd: workDir, encoding: "utf8", timeout: 120000,
            env: { ...process.env, HOME: home, errFile, NODE_OPTIONS: `--import=${pathToFileURL(mock).href}`, ...env },
        });
        return { ...result, stderr: result.stderr + fs.readFileSync(errFile, "utf8") };
    };
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");

    const target = path.join(cloud, "fedBonds");
    const stems = ["fedBonds"];
    for (const side of ["ask", "bid"]) {
        stems.push(`fedNominal-${side}`, `fedTips-${side}`, `fedNominal-grid-${side}`, `fedNominal-grid-fwd-${side}`);
        for (const qualifier of ["", "sa-", "sa-decay-", "fwd-", "fwd-sa-", "fwd-sa-decay-"]) {
            stems.push(`fedTips-curve-${qualifier}${side}`, `fedBei-grid-${qualifier}${side}`);
        }
    }
    assert.equal(stems.length, 33);
    const json = name => JSON.parse(fs.readFileSync(path.join(target, name), "utf8"));
    for (const name of stems) {
        const value = json(`${name}-rate.json`);
        assert.ok(Array.isArray(value) ? value.length > 0 : value.asOfDate === record.asOfDate, name);
        for (const ext of ["json", "csv"]) {
            const daily = `${record.asOfDate}-${name === "fedBonds" ? "rate" : name}.${ext}`;
            assert.equal(fs.readFileSync(path.join(target, `${name}-rate.${ext}`), "utf8"),
                fs.readFileSync(path.join(target, "daily", daily), "utf8"));
        }
    }
    for (const side of ["ask", "bid"]) {
        for (const family of ["Nominal", "Tips"]) {
            assert.ok(json(`fed${family}-${side}-rate.json`).every(row => row.report_source === `FedInvest ${side}`));
            assert.ok(json(`fed${family}-${side}-rate.json`).every(row => row.settle_date === record.asOfDate));
        }
        assert.equal(json(`fedNominal-grid-${side}-rate.json`).points.length, 60);
        assert.equal(json(`fedBei-grid-${side}-rate.json`).points.length, 60);
        assert.equal(json(`fedTips-curve-${side}-rate.json`).basis, `FedInvest-${side}-settle`);
        assert.equal(json(`fedNominal-grid-${side}-rate.json`).settleDate, record.asOfDate);
        for (const qualifier of ["", "sa-", "sa-decay-", "fwd-", "fwd-sa-", "fwd-sa-decay-"]) {
            const expectedDate = qualifier.startsWith("fwd-") ? "2026-11-01" : record.asOfDate;
            assert.equal(json(`fedTips-curve-${qualifier}${side}-rate.json`).settleDate, expectedDate);
            assert.equal(json(`fedBei-grid-${qualifier}${side}-rate.json`).settleDate, expectedDate);
        }
    }
    assert.ok(json("fedBonds-rate.json").some(row => row.securitytype === "FRN"));
    assert.ok(json("fedNominal-ask-rate.json").every(row => row.security_type !== "FRN"));
    assert.equal(json("fedTips-fitHistory-rate.json").rows.length, 12);
    assert.equal(json("fedTips-fitHistory-rate.json").summary.length, 4);
    assert.equal(json("fedBei-stability-rate.json").rows.length, 8);
    assert.equal(json("fedBei-stability-rate.json").summary.length, 16);
    const cache = JSON.parse(fs.readFileSync(path.join(cwd, "history/fedBei-stability-cache.json"), "utf8"));
    assert.equal(cache.key, "shortYears=3;v3-t0");
    assert.equal(typeof cache.entries["2026-10-02|ask|sa|settle"], "object");
    assert.equal(loadArchivedCurves(path.join(target, "daily"), "fed").length, 4);
    assert.equal(loadSnapshots(path.join(target, "daily"), "fed").length, 2);
    assert.equal(loadArchivedCurves(path.join(target, "daily")).length, 0);
    assert.equal(loadSnapshots(path.join(target, "daily")).length, 0);
    for (const directory of [target, path.join(target, "daily")]) {
        for (const family of ["Tips", "Nominal", "Bei"]) {
            const expected = fs.readdirSync(directory).filter(name =>
                name.endsWith(".csv") && name.includes(`fed${family}-`)).sort();
            assert.deepEqual(fs.readFileSync(path.join(directory, `fed${family}-manifest.txt`), "utf8").trim().split("\n"), expected);
        }
    }
    assert.equal(fs.readdirSync(target).filter(name => name.endsWith(".json")).length, 35);
    assert.equal(fs.readdirSync(target).filter(name => name.endsWith(".csv")).length, 37);
    assert.equal(fs.readdirSync(path.join(target, "daily")).filter(name => name.endsWith(".json")).length, 33);
    assert.deepEqual(fs.readdirSync(path.join(cloud, "mktBonds")), ["sentinel"]);
    assert.equal(fs.readFileSync(path.join(cloud, "mktBonds/sentinel"), "utf8"), "unchanged");
    assert.ok(fs.readdirSync(path.join(cwd, "history")).every(name => name.startsWith("fed") || name === "daily"));
    const archive = path.join(cwd, "history/daily");
    for (const name of fs.readdirSync(path.join(target, "daily"))) {
        assert.equal(fs.readFileSync(path.join(archive, name), "utf8"),
            fs.readFileSync(path.join(target, "daily", name), "utf8"));
    }

    const published = fs.readFileSync(path.join(target, "fedBonds-rate.json"), "utf8");
    const marketDir = path.join(repo, "mktBonds");
    fs.mkdirSync(path.join(marketDir, "history"));
    fs.writeFileSync(path.join(repo, "market-quotes.json"), JSON.stringify(toPublishedRows(input).map(row => ({
        asOfDate: `${row.asOfDate}T1405`, cusip: row.cusip, securityType: row.securitytype,
        coupon: row.interest_rate * 100, maturityDate: row.maturity_date,
        bidPrice: row.bid, askPrice: row.ask, description: row.description,
    }))));
    fs.writeFileSync(path.join(marketDir, "collect-mktBonds.sh"), '#!/usr/bin/bash\ncat ../market-quotes.json\n');
    const marketEnv = {
        BOND_SOURCE_NAME: "", BOND_REPORT_PREFIX: "", BOND_REPORT_SOURCE: "",
        BOND_SETTLEMENT_DAYS: "",
        BOND_COLLECTION_SCRIPT: "", BOND_PROCESS_SCRIPT: "",
        BOND_TIPS_META_FILE: path.join(cloud, "TIPSmeta.csv"),
    };
    for (const job of ["job-mktBonds-update.sh", "job-mktTips-update.sh"]) {
        const market = run(`./${job}`, marketDir, marketEnv);
        assert.equal(market.status, 0, market.stdout + market.stderr);
        assert.equal(market.stderr, "");
    }
    const marketTarget = path.join(cloud, "mktBonds");
    for (const stem of stems) {
        assert.ok(fs.existsSync(path.join(marketTarget, `${stem.replace(/^fed/, "mkt")}-rate.json`)), stem);
    }
    const nominal = JSON.parse(fs.readFileSync(path.join(marketTarget, "mktNominal-ask-rate.json"), "utf8"));
    assert.ok(nominal.every(row => row.report_source === "Market ask" && row.asOfDate.endsWith("T1405")));
    assert.ok(nominal.every(row => row.settle_date === "2026-10-05"));
    for (const name of ["mktTips-ask", "mktTips-bid"]) {
        const rows = JSON.parse(fs.readFileSync(path.join(marketTarget, `${name}-rate.json`), "utf8"));
        assert.ok(rows.every(row => row.settle_date === "2026-10-05"));
    }
    assert.equal(fs.readFileSync(path.join(target, "fedBonds-rate.json"), "utf8"), published);

    const latestBefore = Object.fromEntries(fs.readdirSync(target).filter(name =>
        fs.statSync(path.join(target, name)).isFile()).map(name => [name, fs.readFileSync(path.join(target, name), "utf8")]));
    const historicalInput = input.map(row => ({ ...row, asOfDate: "2026-10-01" }));
    const savedDir = path.join(cloud, "FedInvest/daily");
    fs.mkdirSync(savedDir, { recursive: true });
    fs.writeFileSync(path.join(savedDir, "2026-10-01-rate.json"), JSON.stringify(historicalInput));
    const historicalRun = args => spawnSync(process.execPath, [path.join(cwd, "report-history.mjs"), ...args], {
        cwd: repo, encoding: "utf8", timeout: 120000,
        env: { ...process.env, HOME: home, NODE_OPTIONS: `--import=${pathToFileURL(mock).href}` },
    });
    const history = historicalRun(["2026-10-01"]);
    assert.equal(history.status, 0, history.stdout + history.stderr);
    assert.match(history.stdout, /Using saved FedInvest quotes/);
    for (const stem of stems) {
        const name = `2026-10-01-${stem === "fedBonds" ? "rate" : stem}.json`;
        const value = json(`daily/${name}`);
        if (Array.isArray(value)) {
            assert.ok(value.every(row => row.asOfDate === "2026-10-01"));
            if (stem !== "fedBonds") assert.ok(value.every(row => row.settle_date === "2026-10-01" && row.fwd_date === "2026-11-01"));
        } else assert.equal(value.asOfDate, "2026-10-01");
    }
    const explicit = historicalRun(["2026-10-01", `--input=${path.join(savedDir, "2026-10-01-rate.json")}`]);
    assert.equal(explicit.status, 0, explicit.stdout + explicit.stderr);
    const mismatch = historicalRun(["2026-09-30", `--input=${path.join(savedDir, "2026-10-01-rate.json")}`]);
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /does not contain quotes/);

    const fetchedInput = input.map(row => ({ ...row, asOfDate: "2026-09-30" }));
    const csv = fetchedInput.map(row => [
        "09/30/2026", row.cusip, row.securitytype, row.rate, row.maturitydate, "", row.buy, row.sell, "0",
    ].join(",")).join("\n");
    fs.writeFileSync(path.join(repo, "FedInvest/collect-FedInvest.sh"),
        `#!/usr/bin/bash\n[ "$1" = "2026-09-30" ] || exit 1\ncat <<'CSV'\n${csv}\nCSV\n`);
    const fetched = historicalRun(["2026-09-30", "--fetch"]);
    assert.equal(fetched.status, 0, fetched.stdout + fetched.stderr);
    assert.match(fetched.stdout, /Fetching FedInvest quotes/);
    assert.ok(fs.existsSync(path.join(savedDir, "2026-09-30-rate.json")));
    assert.equal(fs.readdirSync(path.join(target, "daily")).filter(name => name.startsWith("2026-09-30-")).length, 66);
    const failedFetch = historicalRun(["2026-09-29", "--fetch"]);
    assert.notEqual(failedFetch.status, 0);
    assert.equal(fs.readdirSync(path.join(target, "daily")).filter(name => name.startsWith("2026-09-29-")).length, 0);
    assert.equal(fs.existsSync(path.join(savedDir, "2026-09-29-rate.json")), false);
    for (const [name, content] of Object.entries(latestBefore)) {
        assert.equal(fs.readFileSync(path.join(target, name), "utf8"), content, name);
    }
    assert.equal(fs.readFileSync(inputFile, "utf8"), JSON.stringify(input));
    for (const family of ["Tips", "Nominal", "Bei"]) {
        const daily = path.join(target, "daily");
        const expected = fs.readdirSync(daily).filter(name => name.endsWith(".csv") && name.includes(`fed${family}-`)).sort();
        assert.deepEqual(fs.readFileSync(path.join(daily, `fed${family}-manifest.txt`), "utf8").trim().split("\n"), expected);
    }

    const oldInput = path.join(home, "old-quotes.json");
    fs.writeFileSync(oldInput, JSON.stringify(input.map(row => ({ ...row, asOfDate: "2026-06-01" }))));
    const oldHistory = historicalRun(["2026-06-01", `--input=${oldInput}`]);
    assert.equal(oldHistory.status, 0, oldHistory.stdout + oldHistory.stderr);
    assert.equal(fs.readdirSync(archive).filter(name => name.startsWith("2026-06-01-")).length, 66);
    assert.equal(fs.readdirSync(path.join(target, "daily")).filter(name => name.startsWith("2026-06-01-")).length, 0);
    for (const [name, content] of Object.entries(latestBefore)) {
        assert.equal(fs.readFileSync(path.join(target, name), "utf8"), content, name);
    }

    const refreshed = run();
    assert.equal(refreshed.status, 0, refreshed.stdout + refreshed.stderr);
    assert.ok(json("fedTips-fitHistory-rate.json").rows.some(row => row.asOfDate === "2026-06-01"));
    assert.ok(json("fedBei-stability-rate.json").rows.some(row => row.asOfDate === "2026-06-01"));
    assert.equal(fs.readdirSync(path.join(target, "daily")).some(name => name.startsWith("2026-06-01-")), false);

    fs.writeFileSync(inputFile, JSON.stringify([{ ...record, buy: "invalid" }]));
    const failure = run();
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /Invalid FedInvest/);
    assert.equal(fs.readFileSync(path.join(target, "fedBonds-rate.json"), "utf8"), published);
});
