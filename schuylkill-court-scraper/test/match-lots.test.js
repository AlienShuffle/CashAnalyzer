import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../match-lots.js", import.meta.url));

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "match-lots-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const lots = path.join(dir, "lots.json");
  const cases = path.join(dir, "cases.json");
  const history = path.join(dir, "history");
  const out = path.join(dir, "output");
  fs.writeFileSync(lots, "[]");
  fs.writeFileSync(cases, '{"cases":[]}');
  fs.mkdirSync(history);
  const run = () => spawnSync(process.execPath, [script, "--lots", lots, "--cases", cases, "--lot-history", history, "--out", out], { encoding: "utf8" });
  return { lots, history, out, run };
}

test("empty historical snapshots warn while valid snapshots are still used", (t) => {
  const { history, out, run } = setup(t);
  for (const [date, contents] of [
    ["2026-01-01", ""],
    ["2026-01-02", " \n\t"],
    ["2026-01-03", '[{"lot":"1","address":"123 MAIN ST"}]']
  ]) {
    const dir = path.join(history, date);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "4-lot-normalized.json"), contents);
  }
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /skipping empty historical lot snapshot: .*2026-01-01/);
  assert.match(result.stderr, /skipping empty historical lot snapshot: .*2026-01-02/);
  assert.match(result.stdout, /\(\+1 historical mailing records\)/);
  assert.ok(fs.existsSync(path.join(out, "lot-matches.json")));
});

test("malformed historical and required JSON fail with the input filename", (t) => {
  const { lots, history, out, run } = setup(t);
  const snapshotDir = path.join(history, "2026-01-01");
  const snapshot = path.join(snapshotDir, "4-lot-normalized.json");
  fs.mkdirSync(snapshotDir);
  fs.writeFileSync(snapshot, "[");
  let result = run();
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`Invalid JSON in ${snapshot}:`));
  assert.equal(fs.existsSync(out), false);

  fs.writeFileSync(lots, "");
  result = run();
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`Invalid JSON in ${lots}:`));
  assert.equal(fs.existsSync(out), false);
});
