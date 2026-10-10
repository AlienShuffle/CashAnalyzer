import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { createHash, randomUUID } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { legacyWrappers, publicFunctions, wrapperPlans } from "../../fintools/sync-wrappers.mjs";

const library = new URL("../../fintools/lib/", import.meta.url);
const wrappers = new URL("../../fintools/wrapper/", import.meta.url);
const plain = value => Array.isArray(value) ? Array.from(value, plain) : value;
const blob = value => ({
    getBytes: () => Buffer.from(value),
    getDataAsString: () => Buffer.from(value).toString(),
});
const utilities = {
    DigestAlgorithm: { SHA_1: "sha1" }, Charset: { UTF_8: "utf8" },
    computeDigest: (algorithm, text) => createHash(algorithm).update(text).digest(),
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString("base64url"),
    base64Encode: bytes => Buffer.from(bytes).toString("base64"),
    base64Decode: text => Buffer.from(String(text), "base64"),
    newBlob: blob,
    zip: blobs => blob(deflateSync(Buffer.concat(blobs.map(value => value.getBytes())))),
    unzip: value => [blob(inflateSync(value.getBytes()))],
    getUuid: randomUUID,
};

function setup() {
    const store = new Map();
    const writes = [];
    const calls = [];
    const cache = {
        get: key => store.get(key) ?? null,
        getAll: keys => Object.fromEntries(keys.map(key => [key, store.get(key)])),
        put(key, value, expiry) {
            assert.ok(Number.isInteger(expiry) && expiry >= 1 && expiry <= 21600, `expiry ${expiry}`);
            writes.push({ key, value, expiry });
            store.set(key, value);
        },
        putAll(entries, expiry) {
            for (const [key, value] of Object.entries(entries)) this.put(key, value, expiry);
        },
    };
    const core = vm.createContext({
        Date, Math, Logger: { log() { } }, Utilities: utilities,
        CacheService: {
            getScriptCache: () => cache,
            getUserCache: () => cache,
            getDocumentCache: () => null,
        },
        UrlFetchApp: { fetch(url) {
            calls.push(url);
            throw new Error("Unexpected URL: " + url);
        } },
    });
    for (const file of readdirSync(library).filter(file => file.endsWith(".js")).sort()) {
        vm.runInContext(readFileSync(new URL(file, library), "utf8"), core, { filename: file });
    }
    core.timeGetNYCTime_ = () => new Date(2026, 9, 9, 12);
    const sheet = vm.createContext({ fintools: core });
    for (const { file } of legacyWrappers) {
        vm.runInContext(readFileSync(new URL(file, wrappers), "utf8"), sheet);
    }
    return { core, sheet, store, writes, calls, cache };
}

test("all legacy APIs have library-derived wrappers, typed contracts, examples and correct exposure", () => {
    const { core } = setup();
    const plans = wrapperPlans().filter(plan => plan.url.pathname.includes("/fintools/wrapper/fintools."));
    assert.equal(plans.flatMap(plan => plan.functions).length, 40);
    for (const plan of plans) {
        for (const fn of plan.functions) {
            assert.equal(typeof core[fn.name], "function", fn.name);
            const signature = core[fn.name].toString().match(/^function \w+\(([^)]*)\)/)[1];
            assert.deepEqual(signature.split(",").map(value => value.trim()).filter(Boolean), fn.parameters);
            assert.match(fn.doc, /@return \{[^}]+\}/, fn.name);
            if (fn.name !== "bankGetCachedAccounTypes") assert.match(fn.doc, /Example/i, fn.name);
            assert.equal(fn.doc.includes("@customfunction"),
                !["ssSetNamedRangeValue", "buildFidelityFundListTable"].includes(fn.name), fn.name);
        }
    }
    for (const { sources } of legacyWrappers) {
        for (const source of sources) {
            const apis = publicFunctions(readFileSync(new URL(source, library), "utf8"));
            assert.ok(apis.length, source);
        }
    }
});

test("bank APIs preserve names, shapes, dates, refresh semantics and required history account", () => {
    const { core, sheet, writes } = setup();
    let fetches = 0;
    let path;
    core.cloudGetFileContents_ = url => {
        fetches++;
        path = url;
        if (url.endsWith("bank-list.txt")) return "Ally\r\nyieldFinder\r\n";
        if (url.endsWith("rate-history.json")) return JSON.stringify([
            { accountType: "Savings", asOfDate: "2026-10-08", apy: 0.04 },
            { accountType: "Savings", asOfDate: "2026-10-09", apy: 0.041 },
        ]);
        return JSON.stringify([
            { accountType: "Savings", asOfDate: "2026-10-09", apy: 0.04 },
            { accountType: "Checking", asOfDate: "2026-10-09", apy: 0.001 },
        ]);
    };
    const rate = sheet.bankGetCachedRate("Ally", "savings");
    assert.deepEqual(plain(rate), [[new Date(2026, 9, 9), 0.04]]);
    sheet.bankGetCachedRate("Ally", "savings");
    assert.equal(fetches, 1);
    sheet.bankGetCachedRate("Ally", "savings", true);
    assert.equal(fetches, 2);
    assert.deepEqual(plain(sheet.bankGetCachedAllRates("Ally")), [
        ["Checking", new Date(2026, 9, 9), 0.001],
        ["Savings", new Date(2026, 9, 9), 0.04],
    ]);
    assert.deepEqual(plain(sheet.bankGetCachedAccountTypes("Ally")), ["Checking", "Savings"]);
    const cachedFetches = fetches;
    assert.deepEqual(plain(sheet.bankGetCachedAccounTypes("Ally")), ["Checking", "Savings"]);
    assert.equal(fetches, cachedFetches);
    assert.equal(typeof sheet.bankGetCurrentRateFileContents("Ally"), "string");
    assert.equal(typeof sheet.bankGetCurrentRateHistoryFileContents("Ally", "Savings"), "string");
    assert.equal(path, "Banks/Ally/history/Savings/rate-history.json");
    assert.throws(() => sheet.bankGetCurrentRateHistoryFileContents("Ally"), /account type is required/);
    const history = sheet.bankGetCachedRateHistory("Ally", "Savings", new Date(2026, 9, 8), new Date(2026, 9, 9));
    assert.equal(history.length, 2);
    assert.deepEqual(plain(sheet.bankGetCachedRateHistoryDates("Ally", "Savings")), [
        [new Date(2026, 9, 8), new Date(2026, 9, 9)],
    ]);
    assert.deepEqual(plain(sheet.bankCachedAvailableBanks()), [["Ally"], ["yieldFinder"]]);
    assert.ok(writes.every(write => write.expiry <= 21600));
    assert.throws(() => sheet.bankGetCachedRateHistory("Ally", "Savings", "bad", "bad"), /Invalid.*date range/);
    assert.throws(() => sheet.bankGetCachedRateHistory("Ally", "Savings", "2020-01-01", "2020-02-01"), /No bank history/);
});

test("bank retrieval errors preserve string exceptions and fallback paths", () => {
    const { core, sheet } = setup();
    const paths = [];
    core.cloudGetFileContents_ = path => { paths.push(path); throw "network unavailable"; };
    assert.throws(() => sheet.bankGetCurrentRateFileContents("Ally"), /network unavailable/);
    assert.throws(() => sheet.bankGetCurrentRateHistoryFileContents("Ally", "Savings"), /network unavailable/);
    assert.equal(paths.length, 4);
    assert.throws(() => sheet.bankCachedAvailableBanks(true), /network unavailable/);
    core.bankGetCurrentRateFileContents = () => "";
    assert.throws(() => sheet.bankGetCachedAllRates("Ally", true), /No content found for bank: Ally/);
    assert.throws(() => sheet.bankGetCachedAccountTypes("Ally", true), /No content found for bank: Ally/);
});

test("Cloudflare fetch failures retain the URL and original error details", () => {
    const { core } = setup();
    core.UrlFetchApp = { fetch() { throw new Error("HTTP 503"); } };
    assert.throws(() => core.cloudGetFileContents_("MM/SPAXX/SPAXX-rate-history.json"),
        /cashoptimizer\.pages\.dev\/MM\/SPAXX\/SPAXX-rate-history\.json: HTTP 503/);
});

test("Cloud History returns sorted, gap-filled decimal yields and consistent fresh/cached dates", () => {
    const { core, sheet, writes } = setup();
    let fetches = 0;
    core.cloudGetYieldHistoryJson_ = () => {
        fetches++;
        return [
            { asOfDate: "2026-10-09", oneDayYield: 0.041, sevenDayYield: 0.042 },
            { asOfDate: "2026-10-07", oneDayYield: 0, sevenDayYield: 0.04 },
        ];
    };
    const args = ["SPAXX", new Date(2026, 9, 7), new Date(2026, 9, 9)];
    const table = sheet.cloudGetCachedYieldHistory(...args);
    assert.equal(table.length, 4);
    assert.deepEqual(plain(table[2]), [new Date(2026, 9, 8), 0, 0.04, ""]);
    assert.deepEqual(plain(sheet.cloudGetCachedYieldHistory(...args)), plain(table));
    assert.equal(fetches, 1);
    sheet.cloudGetCachedYieldHistory(...args, true, true);
    assert.equal(fetches, 2);
    assert.deepEqual(plain(sheet.cloudGetCachedOneDayYieldHistory(...args))[0], [new Date(2026, 9, 7), 0]);
    assert.equal(sheet.cloudGetCachedSevenDayYieldHistory(...args)[2][1], 0.042);
    assert.deepEqual(plain(sheet.cloudGetCachedYieldHistoryRange("SPAXX")), [
        [new Date(2026, 9, 7), new Date(2026, 9, 9)],
    ]);
    const previous = fetches;
    sheet.cloudGetCachedYieldHistoryRange("SPAXX");
    assert.equal(fetches, previous);
    assert.ok(writes.every(write => write.expiry === 21600));
});

test("Cloud History errors propagate instead of blaming the ticker or indexing an empty result", () => {
    const { core, sheet, writes } = setup();
    core.cloudGetYieldHistoryJson_ = () => [];
    assert.throws(() => sheet.cloudGetCachedYieldHistoryRange("SPAXX"), /No yield history/);
    assert.equal(writes.length, 0, "Do not cache a disguised failure");
    const error = new Error("invalid JSON response");
    core.cloudGetYieldHistoryJson_ = () => { throw error; };
    assert.throws(() => sheet.cloudGetCachedYieldHistoryRange("SPAXX"), value => value === error);
    core.cloudGetCachedYieldHistory = () => [];
    assert.throws(() => sheet.cloudGetCachedYieldFromHistory("SPAXX"), /last five days/);
    core.cloudGetYieldHistoryJson_ = () => [{ asOfDate: "2026-10-07", sevenDayYield: 0.04 }];
    assert.throws(() => core.cloudGetYieldHistory_("SPAXX", "bad", "bad"), /Invalid yield history date range/);
    assert.throws(() => core.cloudGetYieldHistory_("SPAXX", "2020-01-01", "2020-01-02"), /No yield history/);
    core.cloudGetYieldHistoryJson_ = () => [{ asOfDate: "not a date" }];
    assert.throws(() => sheet.cloudGetCachedYieldHistoryRange("SPAXX"), /Invalid yield history date/);
});

test("cache helpers bound expiry and the real Cacher honors options and caps child expiries", () => {
    const { core, writes, cache } = setup();
    assert.equal(core.cacheBoundTTL_(0), 1);
    assert.equal(core.cacheBoundTTL_(86400), 21600);
    assert.equal(core.cacheBoundTTL_(120.9), 120);
    assert.throws(() => core.cacheBoundTTL_(NaN), /Invalid cache expiry/);
    core.timeGetNYCTime_ = () => new Date(2026, 9, 10, 11);
    assert.equal(core.cacheCalcTTLAfterHour_(11), 1);
    assert.equal(core.cacheCalcTTLAfterHour_(6), 21600);
    assert.equal(core.cacheCalcTTL_(new Date(2020, 0, 1)), 21600);
    assert.equal(core.treasuryCalcCacheTTL_(new Date(2020, 0, 1)), 21600);
    const Cacher = vm.runInContext("Cacher", core);
    const probe = new Cacher({ cachePoint: cache });
    probe.keyer = () => "probe";
    vm.runInContext('Compress.keyChunks = () => ({parent: {}, children: [{key: "child"}]})', core);
    probe.set("key", "data", { expiry: 21600 });
    assert.deepEqual(writes.map(write => write.expiry), [21600, 21600]);
    probe.set("key", "data", { expiry: 120 });
    assert.deepEqual(writes.slice(-2).map(write => write.expiry), [130, 120]);
});

test("Treasury uses the current year, honors period semantics, and preserves rectangular tables", () => {
    const { core, sheet, calls } = setup();
    const fields = [
        ["NEW_DATE", "2026-10-09T00:00:00"],
        ["BC_1MONTH", "4.0"],
        ["TC_5YEAR", "2.0"],
        ["INDEX_DATE", "2026-10-09T00:00:00"],
        ["ROUND_B1_YIELD_4WK_2", "4.1"],
        ["ROUND_B1_CLOSE_4WK_2", "4.0"],
    ].map(([name, value]) => ({ getName: () => name, getValue: () => value }));
    const root = {
        getNamespace: () => null,
        getChildren: () => [{ getChild: () => ({ getChildren: () => [{ getChildren: () => fields }] }) }],
    };
    core.XmlService = { parse: () => ({ getRootElement: () => root }) };
    core.UrlFetchApp = { fetch(url) { calls.push(url); return { getContentText: () => "<xml/>" }; } };
    const table = sheet.treasuryGetCachedGovYields();
    assert.match(calls[0], new RegExp(`field_tdr_date_value=${new Date().getFullYear()}$`));
    assert.equal(table[1][1], 0.04);
    assert.equal(table[1].length, 14);
    assert.equal(table[1][2], "");
    sheet.treasuryGetCachedGovYields();
    assert.equal(calls.length, 1);
    const real = sheet.treasuryGetCachedGovYields(202610, "REAL", true);
    assert.match(calls.at(-1), /field_tdr_date_value=2026$/);
    assert.equal(real[1][1], 0.02);
    assert.equal(real[1].length, 6);
    const bills = sheet.treasuryGetCachedTBillYields(202610);
    assert.match(calls.at(-1), /field_tdr_date_value_month=202610$/);
    assert.ok(Math.abs(bills[1][1] - 0.041) < 1e-12);
    assert.equal(bills[1].length, 7);
    assert.equal(bills[1][2], "");
    const discounts = sheet.treasuryGetCachedTBillCoupons(2026);
    assert.equal(discounts[1][1], 0.04);
    assert.throws(() => sheet.treasuryGetCachedGovYields(2026, 123), /type must be a string/);
    assert.throws(() => sheet.treasuryGetCachedGovYields("bad"), /Invalid argument/);
});

test("recent T-bill coupons default to cached behavior, with explicit refresh still supported", () => {
    const { core, sheet } = setup();
    let fetches = 0;
    core.treasuryGetRecentTBillRates_ = type => {
        fetches++;
        assert.equal(type, "coupon");
        return [["Date", "4w"], [new Date(2026, 9, 9), 0.04]];
    };
    const fresh = sheet.treasuryGetCachedRecentTBillCoupons();
    assert.deepEqual(plain(sheet.treasuryGetCachedRecentTBillCoupons()), plain(fresh));
    assert.equal(fetches, 1);
    sheet.treasuryGetCachedRecentTBillCoupons(true);
    assert.equal(fetches, 2);
});

test("Fidelity and CAPE use the date cell for cache aging; metadata uses the current endpoint", () => {
    const { core, sheet, writes } = setup();
    const date = new Date(2026, 9, 9);
    const tradeDates = [];
    core.cacheCalcTTL_ = date => { tradeDates.push(date); return 120; };
    core.fidelityGetYields_ = () => [[date, 0.04, 0.041, 0.042]];
    core.fidelityGet1DayYield_ = () => [[date, 0.04]];
    core.multplGetCAPE_ = () => [[date, 35]];
    assert.deepEqual(plain(sheet.fidelityGetCachedYields("SPAXX")), [[date, 0.04, 0.041, 0.042]]);
    sheet.fidelityGetCached1DayYield("SPAXX");
    sheet.multplGetCachedCAPE();
    assert.deepEqual(tradeDates, [date, date, date]);
    let factsFund;
    core.fidelityRetrieveFundJSON_ = fundId => { factsFund = fundId; return { overview: { tradingSymbol: "SPAXX" } }; };
    const facts = core.retrieveFidelityFundFacts_("458");
    assert.equal(facts.tradingSymbol, "SPAXX");
    assert.equal(factsFund, "458");
    assert.equal(writes.at(-1).expiry, 21600);
    core.fidelityRetrieveFundJSON_ = () => ({ historicalPricingYield: [{ prices: [
        { date: "2026-10-09", milRateAndYields: [{ oneDayYield: 4, sevenDayYield: 4.1, thirtyDayYield: 4.2 }] },
        { date: "2026-10-08", milRateAndYields: [{ oneDayYield: 3.9, sevenDayYield: 4, thirtyDayYield: 4.1 }] },
    ] }] });
    const history = sheet.fidelityGetCachedRecentYieldHistory("SPAXX");
    assert.ok(history[0][0] < history[1][0]);
    assert.equal(history[0][1], 0.039);
    assert.equal(sheet.fidelityGetCachedRecent1DayYieldHistory("SPAXX")[0].length, 2);
    core.fidelityRetrieveFundJSON_ = () => ({ historicalPricingYield: [{ prices: [] }] });
    assert.throws(() => sheet.fidelityGetCachedRecentYieldHistory("SPAXX", true), /No recent Fidelity/);
});

test("Yahoo preserves epoch timestamps, decimal changes and cached dates, and reports invalid quotes", () => {
    const { core, sheet } = setup();
    const epoch = 1791550800;
    let fetches = 0;
    let meta = { regularMarketTime: epoch, gmtoffset: -14400, regularMarketPrice: 105, chartPreviousClose: 100 };
    core.UrlFetchApp = { fetch() { fetches++; return { getContentText: () => JSON.stringify({ chart: { result: [{ meta }] } }) }; } };
    const price = sheet.yahooGetCachedPrice("VTI");
    assert.equal(price[0][0].getTime(), epoch * 1000);
    assert.equal(price[0].length, 2);
    const quote = sheet.yahooGetCachedPrice("VTI", true);
    assert.equal(quote[0][0].getTime(), epoch * 1000);
    assert.ok(Math.abs(quote[0][2] - 0.05) < 1e-12);
    assert.equal(fetches, 1);
    sheet.yahooGetCachedPrice("VTI", false, true);
    assert.equal(fetches, 2);
    meta = { ...meta, regularMarketPrice: "bad" };
    assert.throws(() => sheet.yahooGetCachedPrice("BAD", false, true), /Invalid Yahoo price.*bad/);
    meta = { ...meta, regularMarketPrice: 105, regularMarketTime: null };
    assert.throws(() => sheet.yahooGetCachedPrice("BAD", false, true), /Invalid Yahoo quote timestamp/);
    core.UrlFetchApp = { fetch: () => ({ getContentText: () => '{"chart":{"result":null}}' }) };
    assert.throws(() => sheet.yahooGetCachedPrice("BAD", false, true), /No Yahoo quote/);
});

test("Yahoo expense ratios are scalar decimals or n/a, and use a service-valid expiry", () => {
    const { core, sheet, writes } = setup();
    let value = "0.03";
    core.UrlFetchApp = { fetch: () => ({ getContentText: () => "markup" }) };
    core.Yahoo_extractExpenseRatio_ = () => value;
    assert.equal(sheet.yahooGetCachedExpenseRatio("VTI"), 0.0003);
    assert.equal(sheet.yahooGetCachedExpenseRatio("VTI"), 0.0003);
    assert.equal(writes[0].expiry, 21600);
    value = "N/A";
    assert.equal(sheet.yahooGetCachedExpenseRatio("NONE"), "n/a");
    value = "broken";
    assert.throws(() => sheet.yahooGetCachedExpenseRatio("BAD"), /Invalid Yahoo expense ratio/);
});

test("Vanguard validates tickers/indices, shortens names, and keeps fresh/cached table dates", () => {
    const { core, sheet, writes } = setup();
    const date = new Date(2026, 9, 9);
    let fetches = 0;
    core.vanguardGetPriceYieldAndAttributes_ = () => {
        fetches++;
        return [Array(12).fill("Header"),
            ["VUSXX", 1, 0.04, "12345", "Vanguard Treasury Money Market Fund Admiral Shares", "", "", "", 0.0009, "Admiral", date, date]];
    };
    const first = sheet.vanguardGetCachedFundSummaries();
    const cached = sheet.vanguardGetCachedFundSummaries();
    assert.deepEqual(plain(cached), plain(first));
    assert.equal(fetches, 1);
    assert.equal(sheet.vanguardGetCachedFundId("VUSXX"), "12345");
    assert.equal(sheet.vanguardGetCachedFundParameter("VUSXX", 4), "Treasury MM Adm");
    assert.equal(sheet.vanguardGetCachedFundParameter("VUSXX", 8), 0.0009);
    for (const index of [-1, 12, 1.5, "8"]) {
        assert.throws(() => sheet.vanguardGetCachedFundParameter("VUSXX", index), /integer from 0 to 11/);
    }
    assert.throws(() => sheet.vanguardGetCachedFundId("BAD"), /invalid ticker/i);
    assert.throws(() => sheet.vanguardGetCachedFundParameter("BAD", 1), /Invalid Vanguard ticker/);
    core.vanguardGetBondAttributes_ = () => [
        Array(9).fill("Header"), ["BND", "Bond", 6.1, 8.2, 0.04, 0.03, date, "Bond", 0.0003],
    ];
    assert.equal(sheet.vanguardGetCachedBondDuration("BND"), 6.1);
    assert.deepEqual(plain(sheet.vanguardGetCachedBondAttributes()), plain(core.vanguardGetBondAttributes_()));
    assert.throws(() => sheet.vanguardGetCachedBondDuration("BAD"), /Invalid Vanguard bond ticker/);
    assert.equal(writes.at(-1).expiry, 21600);
});

test("Vanguard source parsing preserves zero rates, empty fields, numeric durations and dates", () => {
    const { core, sheet } = setup();
    const entity = {
        profile: {
            ticker: "BND", fundId: "12345", longName: "Vanguard Bond Fund", expenseRatio: "",
            fundCategory: { high: { name: "Bond Funds" }, low: { name: "Intermediate" }, customizedHighCategoryName: "Bond" },
            fundFact: { isInstitutionalShare: false, isAdmiralShare: false, isInvestorShare: true },
        },
        dailyPrice: { regular: { price: "75.5", asOfDate: "2026-10-09" } },
        yield: { yieldPct: 0, asOfDate: "2026-10-09" },
        attributes: { averageDuration: 6.1, averageMaturity: "8.2 years", yieldToMaturity: null, averageCoupon: 0 },
        asOfDate: "2026-10-09",
    };
    core.UrlFetchApp = { fetch: () => ({ getContentText: () => JSON.stringify({ fund: { entity: [entity] } }) }) };
    const summary = sheet.vanguardGetCachedFundSummaries();
    assert.equal(summary[1][1], 75.5);
    assert.equal(summary[1][2], 0);
    assert.equal(summary[1][8], "");
    assert.ok(summary[1][10] instanceof Date);
    const bonds = sheet.vanguardGetCachedBondAttributes();
    assert.equal(bonds[1][2], 6.1);
    assert.equal(bonds[1][3], 8.2);
    assert.equal(bonds[1][4], "");
    assert.equal(bonds[1][5], 0);
    assert.equal(bonds[1][8], "");
    assert.throws(() => core.vanguardNumber_("broken"), /Invalid Vanguard numeric value/);
});

test("spreadsheet helpers keep scalar types and scan exact range tokens with one formula read", () => {
    const { core, sheet } = setup();
    let reads = 0;
    let value = 42;
    const formulas = [Array(55).fill("")];
    formulas[0][0] = "=RateHistory";
    formulas[0][1] = '="Rate"';
    formulas[0][2] = "=RATE(1,2,3)";
    formulas[0][3] = "='Rate'!A1";
    formulas[0][4] = "=Rate!A1";
    formulas[0][5] = "=my.rate";
    formulas[0][52] = "=rate+1";
    formulas[0][53] = "=SUM(Rate)";
    const range = {
        getFormulas() { reads++; return formulas; },
        getColumn: () => 1, getRow: () => 1,
    };
    core.SpreadsheetApp = { getActiveSpreadsheet: () => ({
        getActiveSheet: () => ({ getName: () => "Active" }),
        getSheetByName: name => name === "Sheet1" ? { getDataRange: () => range } : null,
        getNamedRanges: () => [{
            getName: () => "Sheet1!Count",
            getRange: () => ({ getValue: () => value, setValue: input => { value = input; } }),
        }],
    }) };
    assert.equal(sheet.ssGetSheetName(), "Active");
    assert.equal(sheet.ssGetNamedRangeValue("Count"), 42);
    assert.equal(sheet.ssSetNamedRangeValue("Count", false), "");
    assert.equal(sheet.ssGetNamedRangeValue("Count"), false);
    assert.throws(() => sheet.ssGetNamedRangeValue("BAD"), /Named range not found/);
    assert.throws(() => sheet.ssSetNamedRangeValue("BAD", 1), /Named range not found/);
    assert.deepEqual(plain(sheet.ssTrackRangeUses("Sheet1", "Rate")), [["BA1"], ["BB1"]]);
    assert.equal(reads, 1);
    assert.equal(sheet.ssTrackRangeUses("Sheet1", "Unreferenced"), "");
    assert.throws(() => sheet.ssTrackRangeUses("BAD", "Rate"), /invalid sheet/);
});

test("TSP public fund letter is required and validated without fetching invalid input", () => {
    const { core, sheet } = setup();
    let received;
    core.tspGetPrice_ = fund => { received = fund; return [[new Date(2026, 9, 9), 18]]; };
    assert.equal(sheet.TSPGetCachedPrice("f")[0][1], 18);
    assert.equal(received, "F");
    assert.throws(() => sheet.TSPGetCachedPrice(), /fund letter must be/);
    assert.throws(() => sheet.TSPGetCachedPrice("BAD"), /fund letter must be/);
});
