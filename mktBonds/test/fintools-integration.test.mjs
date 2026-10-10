import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import vm from "node:vm";
import { migratedFiles, legacyWrappers, publicFunctions, wrapperPlans, syncWrappers } from "../../fintools/sync-wrappers.mjs";

const libraryDir = new URL("../../fintools/lib/", import.meta.url);
const toolkitDir = new URL("../toolkit-app-script-src/", import.meta.url);
const canonicalDir = new URL("../../fintools/wrapper/", import.meta.url);

function loadDirectory(dir, globals = {}) {
    const context = vm.createContext({ Date, Math, Logger: { log() { } }, ...globals });
    for (const file of readdirSync(dir).filter(file => file.endsWith(".js")).sort()) {
        vm.runInContext(readFileSync(new URL(file, dir), "utf8"), context, { filename: file });
    }
    return context;
}

function publicApi(context) {
    return Object.fromEntries(Object.entries(context)
        .filter(([name, value]) => typeof value === "function" && !name.endsWith("_")));
}

test("merged fintools has no duplicate declarations and preserves existing and migrated APIs", () => {
    const names = new Map();
    for (const file of readdirSync(libraryDir).filter(file => file.endsWith(".js"))) {
        const source = readFileSync(new URL(file, libraryDir), "utf8");
        for (const match of source.matchAll(/^(?:function|class|const|let|var)\s+(\w+)/gm)) {
            assert.equal(names.has(match[1]), false, `Duplicate ${match[1]} in ${file}`);
            names.set(match[1], file);
        }
    }
    const context = loadDirectory(libraryDir);
    for (const name of ["bankGetCachedRate", "fidelityGetCachedYields", "ssGetSheetName",
        "treasuryGetCachedGovYields", "treasuryGetCachedRecentRealYields"]) {
        assert.equal(typeof context[name], "function", name);
    }
    for (const file of migratedFiles) {
        for (const { name } of publicFunctions(readFileSync(new URL(file, libraryDir), "utf8"))) {
            assert.equal(typeof context[name], "function", name);
        }
    }
    assert.equal(context.fintools, undefined, "Library must not delegate back into itself");
});

test("canonical and toolkit wrappers are synchronized and forward arguments, defaults and errors", () => {
    assert.equal(syncWrappers(), 0);
    const canonicalPlans = wrapperPlans().filter(plan => plan.url.pathname.includes("/fintools/wrapper/"));
    assert.equal(canonicalPlans.flatMap(plan => plan.functions).length, 79);
    const customFunctions = wrapperPlans().filter(plan => plan.url.pathname.includes("/toolkit-app-script-src/"))
        .flatMap(plan => plan.functions).filter(fn => fn.doc.includes("@customfunction"));
    assert.equal(customFunctions.length, 36);
    for (const file of [...migratedFiles, ...legacyWrappers.flatMap(plan => plan.sources)]) {
        const source = readFileSync(new URL(file, libraryDir), "utf8");
        assert.equal(publicFunctions(source).filter(fn => fn.doc.includes("@customfunction")).length,
            (source.match(/@customfunction/g) ?? []).length, `All annotated APIs in ${file} need wrappers`);
        if (migratedFiles.includes(file)) continue;
        for (const fn of publicFunctions(source)) {
            assert.ok(fn.doc.includes("@return"), `${fn.name} needs a return contract`);
            for (const name of fn.names) {
                assert.ok(new RegExp(`@param \\{[^}]+\\} (?:\\[)?${name}(?:[=\\] ]|$)`).test(fn.doc),
                    `${fn.name} needs documentation for ${name}`);
            }
        }
    }
    for (const { url, content, functions } of wrapperPlans()) {
        assert.equal(readFileSync(url, "utf8"), content);
        for (const fn of functions) {
            let received;
            const result = [[new Date(2026, 9, 10), 1.003]];
            const error = new Error("Library failure");
            const api = { [fn.name](...args) { received = args; return result; } };
            const context = vm.createContext({ fintools: api });
            vm.runInContext(content, context);
            const args = fn.names.map((_, i) => [new Date(2026, 9, 10), [[0.025]], null, false][i % 4]);
            assert.equal(context[fn.name](...args), result);
            assert.deepEqual(received, args, fn.name);
            const expectedDefaults = vm.runInNewContext(
                `(function(${fn.parameters.join(", ")}) { return [${fn.names.join(", ")}]; })()`);
            assert.equal(context[fn.name](), result);
            assert.deepEqual(Array.from(received, value =>
                Array.isArray(value) ? Array.from(value) : value), Array.from(expectedDefaults, value =>
                Array.isArray(value) ? Array.from(value) : value), `${fn.name} defaults`);
            api[fn.name] = () => { throw error; };
            assert.throws(() => context[fn.name](...args), value => value === error);
        }
    }
});

test("worksheet deployment contains only wrappers and its existing menu, not private implementations", () => {
    const context = loadDirectory(toolkitDir, { fintools: publicApi(loadDirectory(libraryDir)) });
    assert.equal(context.mydateNormalize_, undefined);
    assert.equal(context.fitTipsSvensson_, undefined);
    assert.equal(context.cloudGetCachedREFCPI_, undefined);
    assert.equal(typeof context.onOpen, "function");
    assert.equal(typeof context.forceUpdate, "function");
    assert.equal(context.myYieldFromPrice("2026-10-15", "2030-10-15", 0.05, 100), 0.05);
    assert.equal(context.mybondCalcMDuration("2026-10-15", "2030-10-15", 0.05, 0.05),
        loadDirectory(libraryDir).mybondCalcMDuration("2026-10-15", "2030-10-15", 0.05, 0.05));
    loadDirectory(canonicalDir, { fintools: publicApi(loadDirectory(libraryDir)) });
});

function blob(value) {
    const bytes = Buffer.from(value);
    return { getBytes: () => bytes, getDataAsString: () => bytes.toString("utf8") };
}

// Local stand-ins for Apps Script's digest/blob/archive services.
const utilities = {
    DigestAlgorithm: { SHA_1: "sha1" },
    Charset: { UTF_8: "utf8" },
    computeDigest: (algorithm, text) => createHash(algorithm).update(text).digest(),
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString("base64url"),
    base64Encode: bytes => Buffer.from(bytes).toString("base64"),
    base64Decode: text => Buffer.from(String(text), "base64"),
    newBlob: blob,
    zip: blobs => blob(deflateSync(Buffer.concat(blobs.map(value => value.getBytes())))),
    unzip: value => [blob(inflateSync(value.getBytes()))],
    getUuid: randomUUID,
};

test("REFCPI works through worksheet wrappers with fintools Cacher and document/script cache", () => {
    const year = new Date().getFullYear();
    for (const documentBound of [true, false]) {
        const values = new Map();
        const expiries = [];
        const cache = {
            get: key => values.get(key) ?? null,
            put(key, value, expiry) { values.set(key, value); expiries.push(expiry); },
            getAll: keys => Object.fromEntries(keys.map(key => [key, values.get(key)])),
            putAll(entries, expiry) {
                for (const [key, value] of Object.entries(entries)) this.put(key, value, expiry);
            },
        };
        let fetches = 0;
        let scriptCaches = 0;
        const core = loadDirectory(libraryDir, {
            Utilities: utilities,
            CacheService: {
                getDocumentCache: () => documentBound ? cache : null,
                getScriptCache: () => { scriptCaches++; return cache; },
            },
            UrlFetchApp: { fetch() {
                fetches++;
                return { getContentText: () =>
                    `Date,REFCPINSA,REFCPISA,SAFactor,MMDD,maxREFCPI\n` +
                    `${year}-03-02,330.1,329.9,1.00061,M0302,${year}-04-01\n` +
                    `${year}-03-01,330,329.7,1.00091,M0301,${year}-04-01` };
            } },
        });
        core.timeGetNYCTime_ = () => new Date(year, 2, 2, 8);
        const sheet = loadDirectory(toolkitDir, { fintools: publicApi(core) });
        const fresh = sheet.tipsGetCachedREFCPI();
        const cached = sheet.tipsGetCachedREFCPI();
        assert.deepEqual(Array.from(cached, row => Array.from(row)), Array.from(fresh, row => Array.from(row)));
        assert.equal(cached.length, 3);
        assert.ok(cached[1][0] instanceof Date);
        assert.ok(cached[1][5] instanceof Date);
        assert.equal(sheet.tipsGetFactor(`${year + 5}-03-01`), 1.00091);
        assert.equal(sheet.tipsGetRefCpi(`${year}-03-01`), 330);
        assert.equal(sheet.tipsGetMaxRefCpiDate(), `${year}-03-02`);
        assert.equal(fetches, 1);
        sheet.tipsGetCachedREFCPI(true);
        assert.equal(fetches, 2);
        assert.deepEqual(expiries, [3 * 3600, 3 * 3600]);
        core.timeGetNYCTime_ = () => new Date(year, 2, 2, 12);
        sheet.tipsGetCachedREFCPI(true);
        assert.equal(expiries.at(-1), 21600, "Honor the Apps Script maximum cache TTL");
        core.timeGetNYCTime_ = () => new Date(year, 2, 2, 11);
        sheet.tipsGetCachedREFCPI(true);
        assert.equal(expiries.at(-1), 1, "An update-hour call must not write with a zero TTL");
        assert.equal(scriptCaches > 0, !documentBound);
    }
});

test("Svensson analysis works through a worksheet wrapper using only public library APIs", () => {
    const core = loadDirectory(libraryDir);
    const sheet = loadDirectory(toolkitDir, { fintools: publicApi(core) });
    const fixture = JSON.parse(readFileSync(new URL("./fixtures-tips-forward-curve.json", import.meta.url), "utf8"));
    const maturities = fixture.bonds.map(row => [row[0]]);
    const coupons = fixture.bonds.map(row => [row[1]]);
    const prices = fixture.bonds.map(row => [row[2]]);
    const actual = sheet.mybondsZeroAnalyze(fixture.settle, maturities, coupons, prices);
    const expected = core.mybondsZeroAnalyze(fixture.settle, maturities, coupons, prices);
    assert.deepEqual(Array.from(actual, row => Array.from(row)), Array.from(expected, row => Array.from(row)));
    assert.equal(actual.length, fixture.bonds.length + 1);
    assert.ok(actual.every(row => row.length === 8));
});
