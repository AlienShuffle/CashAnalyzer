import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guardedHybridRun, selectHybridTickers } from '../hybridRun.mjs';

test('scheduled batches rotate four oldest attempted tickers without duplicates', async t => {
  const stateDir = await mkdtemp(join(tmpdir(), 'vanguard-rotation-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const tickers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'A'];
  assert.deepEqual(await selectHybridTickers(tickers, stateDir), ['A', 'B', 'C', 'D']);
  assert.deepEqual(await selectHybridTickers(tickers, stateDir), ['E', 'F', 'G', 'H']);
  assert.equal((await selectHybridTickers(tickers, stateDir)).length, 4);
});

test('shared cooldown enforces exactly 15 minutes after completion and failures without extending skipped runs', async t => {
  const stateDir = await mkdtemp(join(tmpdir(), 'vanguard-cooldown-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  let clock = 2000000, calls = 0;
  const options = { stateDir, now: () => clock };
  await guardedHybridRun(async () => { calls++; clock += 10000; }, options);
  clock += 899999;
  await assert.rejects(guardedHybridRun(async () => calls++, options), /cooldown/);
  assert.equal(Number(await readFile(join(stateDir, 'last-attempt'))), 2010000);
  clock++;
  await assert.rejects(guardedHybridRun(async () => { calls++; throw new Error('provider failure'); }, options), /provider failure/);
  await assert.rejects(guardedHybridRun(async () => calls++, options), /cooldown/);
  assert.equal(calls, 2);
});

test('shared lock prevents concurrent provider activity', async t => {
  const stateDir = await mkdtemp(join(tmpdir(), 'vanguard-lock-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  const options = { stateDir, now: () => 2000000 };
  const first = guardedHybridRun(async () => { started(); await hold; }, options);
  await ready;
  await assert.rejects(guardedHybridRun(async () => assert.fail('concurrent collection'), options), /already locked/);
  release();
  await first;
});
