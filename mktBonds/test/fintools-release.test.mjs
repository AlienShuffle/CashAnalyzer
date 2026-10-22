import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("release dry runs include the TIPS wrapper by default, with all, and as a standalone target", () => {
    const root = mkdtempSync(path.join(tmpdir(), "fintools-release-"));
    try {
        const bin = path.join(root, "bin");
        mkdirSync(bin);
        writeFileSync(path.join(bin, "git"), "#!/bin/sh\nprintf 'abcdef0\\n'\n", { mode: 0o755 });
        writeFileSync(path.join(bin, "clasp"), "#!/bin/sh\nexit 99\n", { mode: 0o755 });
        for (const dir of ["fintools/lib", "fintools/wrapper", "fintools/wrapper-tips",
            "mktBonds/toolkit-app-script-src"]) {
            mkdirSync(path.join(root, dir), { recursive: true });
            writeFileSync(path.join(root, dir, ".clasp.json"), "{}");
            writeFileSync(path.join(root, dir, ".clasp.auth"), "{}");
        }
        writeFileSync(path.join(root, "mktBonds/toolkit-app-script-src/appsscript.json"), JSON.stringify({
            dependencies: { libraries: [{
                libraryId: "1M2LjvkaLTyGVMIu2BgQB1KVPUKBP1Aydv8WL4PQSyFZQybXWkOAPzAhn",
                version: "1"
            }] }
        }));
        const script = path.join(root, "fintools/clasp-release.sh");
        cpSync(new URL("../../fintools/clasp-release.sh", import.meta.url), script);
        const run = targets => spawnSync("bash", [
            script, "--dry-run", "--skip-checks", "--pin", "1", ...targets
        ], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
        for (const targets of [[], ["all"], ["wrapper-tips"], ["wrapper"]]) {
            const result = run(targets);
            assert.equal(result.status, 0, result.stdout + result.stderr);
            const output = result.stdout + result.stderr;
            const expectsTips = targets[0] !== "wrapper";
            assert.equal(output.includes("cd fintools/wrapper-tips && clasp -A .clasp.auth push --force"),
                expectsTips);
            if (targets[0] === "wrapper-tips") {
                assert.doesNotMatch(output, /cd fintools\/(?:lib|wrapper) &&|cd mktBonds\//);
            }
            if (targets.length === 0 || targets[0] === "all") {
                assert.match(output, /Releasing \[lib wrapper wrapper-tips toolkit\]/);
            }
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
