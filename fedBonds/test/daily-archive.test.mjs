import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { retentionCutoff, syncDailyArchive, dailyReportDirectory, archivedInputPath,
    localDaily, publishedDaily } from "../lib/daily-archive.mjs";

test("retention uses three calendar months with an inclusive, month-end-clamped cutoff", () => {
    for (const [today, cutoff] of [
        ["2026-10-26", "2026-07-26"], ["2026-05-31", "2026-02-28"],
        ["2024-05-31", "2024-02-29"], ["2026-01-31", "2025-10-31"],
    ]) assert.equal(retentionCutoff(new Date(today)), cutoff);
    assert.throws(() => retentionCutoff(new Date("invalid")), /Invalid retention/);
});

test("research defaults and existing input hashes resolve to the full local archive", () => {
    assert.equal(dailyReportDirectory(path.dirname(path.dirname(publishedDaily))), localDaily);
    assert.equal(archivedInputPath(path.join(publishedDaily, "2015-01-09-rate.json")),
        path.join(localDaily, "2015-01-09-rate.json"));
    assert.equal(dailyReportDirectory("/custom/Treasuries"), "/custom/Treasuries/fedBonds/daily");
    assert.equal(archivedInputPath("/custom/Treasuries/fedBonds/daily/test.json"),
        "/custom/Treasuries/fedBonds/daily/test.json");
});

function fixture(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "fed-daily-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const published = path.join(home, "published"), archive = path.join(home, "archive");
    fs.mkdirSync(published);
    fs.mkdirSync(archive);
    return { published, archive, today: new Date("2026-10-26") };
}

test("publication preserves full history, prunes only old snapshots and rebuilds manifests", t => {
    const options = fixture(t);
    const put = (directory, name, text = name) => fs.writeFileSync(path.join(directory, name), text);
    const old = ["2015-01-09-rate.json", "2026-07-25-fedTips-ask.csv", "2026-07-25-fedTips-ask.json"];
    const recent = ["2026-07-26-fedTips-ask.csv", "2026-10-26T1405-fedBei-grid-bid.csv", "2026-10-26-rate.json"];
    for (const name of [...old, ...recent]) put(options.published, name);
    put(options.archive, "2026-10-25-fedNominal-ask.csv");
    put(options.published, "sentinel.txt", "unchanged");
    const latest = path.join(path.dirname(options.published), "fedTips-ask-rate.json");
    fs.writeFileSync(latest, "latest unchanged");
    const imported = syncDailyArchive({ ...options, archiveOnly: true });
    assert.equal(imported.archived, 7);
    assert.equal(imported.removed, 0);
    for (const name of old) assert.ok(fs.existsSync(path.join(options.published, name)));

    const result = syncDailyArchive(options);
    assert.deepEqual(result, { cutoff: "2026-07-26", archived: 7, published: 4, removed: 3 });
    for (const name of [...old, ...recent]) assert.equal(fs.readFileSync(path.join(options.archive, name), "utf8"), name);
    for (const name of old) assert.equal(fs.existsSync(path.join(options.published, name)), false);
    for (const name of recent) assert.equal(fs.readFileSync(path.join(options.published, name), "utf8"), name);
    assert.equal(fs.readFileSync(path.join(options.published, "fedTips-manifest.txt"), "utf8"), "2026-07-26-fedTips-ask.csv\n");
    assert.equal(fs.readFileSync(path.join(options.archive, "fedTips-manifest.txt"), "utf8"),
        "2026-07-25-fedTips-ask.csv\n2026-07-26-fedTips-ask.csv\n");
    assert.equal(fs.readFileSync(path.join(options.published, "sentinel.txt"), "utf8"), "unchanged");
    assert.equal(fs.readFileSync(latest, "utf8"), "latest unchanged");
    assert.equal(syncDailyArchive(options).removed, 0);
});

test("a differing expired archive copy aborts before any published deletion", t => {
    const options = fixture(t);
    for (const name of ["2015-01-09-rate.json", "2015-01-10-rate.json"]) {
        fs.writeFileSync(path.join(options.published, name), "original");
    }
    fs.writeFileSync(path.join(options.archive, "2015-01-10-rate.json"), "different");
    assert.throws(() => syncDailyArchive(options), /Refusing to prune differing archive/);
    for (const name of ["2015-01-09-rate.json", "2015-01-10-rate.json"]) {
        assert.equal(fs.readFileSync(path.join(options.published, name), "utf8"), "original");
    }
    assert.throws(() => syncDailyArchive({ ...options, archive: options.published }), /must differ/);
});

test("recent local replays replace the published copy without overwriting local history", t => {
    const options = fixture(t);
    const name = "2026-10-26-rate.json";
    fs.writeFileSync(path.join(options.published, name), "previous");
    fs.writeFileSync(path.join(options.archive, name), "recomputed");
    syncDailyArchive(options);
    assert.equal(fs.readFileSync(path.join(options.published, name), "utf8"), "recomputed");
    assert.equal(fs.readFileSync(path.join(options.archive, name), "utf8"), "recomputed");
});
