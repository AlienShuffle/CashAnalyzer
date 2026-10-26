import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));

for (const source of ["FedInvest", "FedInvestToday"]) {
    test(`${source} publishes latest and daily quotes without recreating per-CUSIP history`, t => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), "FedInvest-publication-"));
        t.after(() => fs.rmSync(home, { recursive: true, force: true }));
        const repo = path.join(home, "CashAnalyzer");
        const cwd = path.join(repo, source);
        const cloud = path.join(home, "cloudflare/public/Treasuries", source);
        fs.mkdirSync(cwd, { recursive: true });
        fs.symlinkSync(path.join(root, "bin"), path.join(repo, "bin"));
        fs.symlinkSync(path.join(root, "lib"), path.join(repo, "lib"));
        fs.writeFileSync(path.join(repo, "meta.common.sh"), 'cloudFlareHome="$HOME/cloudflare/public"\n');
        fs.copyFileSync(path.join(root, source, `job-${source}-update.sh`), path.join(cwd, "job.sh"));
        const rows = [{
            asOfDate: "2026-10-26", cusip: "912828YQ7", securitytype: "MARKET BASED NOTE",
            rate: "0.01625", maturitydate: "2030-10-31", calldate: "",
            buy: "99.2", sell: "99.1", endofday: "0", key: "912828YQ7",
        }];
        fs.writeFileSync(path.join(cwd, "inject-rates.json"), JSON.stringify(rows, null, 2));
        for (const repeat of [false, true]) {
            const result = spawnSync("bash", ["./job.sh", "-f"], {
                cwd, encoding: "utf8",
                env: { ...process.env, HOME: home, BOND_DAILY_DIR: "", errFile: path.join(home, "errors.log") },
            });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            assert.equal(result.stderr, "");
            for (const extension of ["json", "csv"]) {
                assert.equal(fs.readFileSync(path.join(cloud, `${source}-rate.${extension}`), "utf8"),
                    fs.readFileSync(path.join(cloud, `daily/2026-10-26-rate.${extension}`), "utf8"));
            }
            assert.deepEqual(JSON.parse(fs.readFileSync(path.join(cloud, `${source}-rate.json`), "utf8")), rows);
            assert.deepEqual(fs.readdirSync(cloud).sort(), [`${source}-rate.csv`, `${source}-rate.json`, "daily"]);
            assert.ok(fs.statSync(path.join(cwd, "history")).isDirectory());
            if (repeat) assert.doesNotMatch(result.stdout, /published updated/);
        }
    });
}
