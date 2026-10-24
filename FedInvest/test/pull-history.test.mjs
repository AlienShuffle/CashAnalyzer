import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("historical quote download publishes dated JSON/CSV without modifying latest quotes", t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "FedInvest-history-"));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const repo = path.join(home, "CashAnalyzer");
    const cwd = path.join(repo, "FedInvest");
    const cloud = path.join(home, "cloudflare/public/Treasuries/FedInvest");
    fs.mkdirSync(path.join(cwd, "history"), { recursive: true });
    fs.mkdirSync(cloud, { recursive: true });
    for (const name of ["lib", "bin"]) fs.symlinkSync(path.join(root, name), path.join(repo, name));
    fs.copyFileSync(path.join(root, "FedInvest/pull-history.sh"), path.join(cwd, "pull-history.sh"));
    const latest = [
        path.join(cwd, "history/FedInvest-rate-new.json"),
        path.join(cloud, "FedInvest-rate.json"), path.join(cloud, "FedInvest-rate.csv"),
    ];
    for (const file of latest) fs.writeFileSync(file, "latest sentinel");
    const collect = text => fs.writeFileSync(path.join(cwd, "collect-FedInvest.sh"), text);
    collect('#!/usr/bin/bash\n[ "$1" = "2026-10-08" ] || exit 9\ncat <<\'CSV\'\n' +
        '10/08/2026,912797VL8,MARKET BASED BILL,0,10/13/2026,,0.000000,99.947222,0\n' +
        '10/08/2026,912828YQ7,MARKET BASED NOTE,0.01625,10/31/2030,,99.2,99.1,0\nCSV\n');
    const run = args => spawnSync("bash", [path.join(cwd, "pull-history.sh"), ...args], {
        cwd: home, env: { ...process.env, HOME: home }, encoding: "utf8",
    });
    const result = run(["2026-10-08"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const json = path.join(cwd, "history/2026-10-08-rate.json");
    const published = fs.readFileSync(json, "utf8");
    const rows = JSON.parse(published);
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => row.asOfDate === "2026-10-08"));
    assert.equal(rows[1].rate, "0.01625");
    for (const ext of ["json", "csv"]) {
        assert.equal(fs.readFileSync(path.join(cwd, `history/2026-10-08-rate.${ext}`), "utf8"),
            fs.readFileSync(path.join(cloud, `daily/2026-10-08-rate.${ext}`), "utf8"));
    }
    assert.match(fs.readFileSync(path.join(cwd, "history/2026-10-08-rate.csv"), "utf8"), /^asOfDate, cusip,/);
    for (const args of [[], ["2026-02-30"], ["2026-10-8"], ["2026-10-08", "--extra"]]) {
        assert.notEqual(run(args).status, 0);
    }
    for (const collector of [
        'exit 7\n',
        'echo "no quotes available"\n',
        'echo "10/07/2026,912797VL8,MARKET BASED BILL,0,10/13/2026,,0,99.9,0"\n',
        'echo "10/08/2026,912797VL8,MARKET BASED BILL,0,10/13/2026,,0,bad,0"\n',
    ]) {
        collect(`#!/usr/bin/bash\n${collector}`);
        assert.notEqual(run(["2026-10-08"]).status, 0);
        assert.equal(fs.readFileSync(json, "utf8"), published);
        assert.equal(fs.readFileSync(path.join(cloud, "daily/2026-10-08-rate.json"), "utf8"), published);
    }
    for (const file of latest) assert.equal(fs.readFileSync(file, "utf8"), "latest sentinel");
    assert.deepEqual(fs.readdirSync(path.join(cwd, "history")).sort(),
        ["2026-10-08-rate.csv", "2026-10-08-rate.json", "FedInvest-rate-new.json"]);
});
