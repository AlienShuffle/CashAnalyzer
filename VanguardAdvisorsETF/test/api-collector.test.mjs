import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectFunds, lookupFund, normalizeFund, requestText } from '../apiCollector.mjs';

const fund = { portId: 'V042', fundIdentifier: 'VBIL', fundName: 'Treasury Bill ETF' };
const raw = () => ({
  yields: {
    secYield: { percent: '3.750000', effectiveDate: '2026-10-09' },
    distributionYield: { percent: '3.50324', effectiveDate: '2026-10-01' },
    yieldToMaturity: { percent: '3.74627', effectiveDate: '2026-08-31' },
    yieldToWorst: { percent: '3.74627', effectiveDate: '2026-08-31' }
  },
  prices: [{ price: 75.52, effectiveDate: '2026-10-12' }, { price: 75.51, effectiveDate: '2026-10-09' }],
  fees: { adjustedExpenseRatio: { value: '0.06', effectiveDate: '2026-04-28' } },
  fundamentals: { averageDuration: { value: '0.101833' }, averageEffectiveMaturity: { value: '0.104597' }, averageCoupon: { value: '0' } },
  assets: {
    assetsUnderManagementData: { amount: 99999999999, effectiveDate: '2026-09-30' },
    fundNetAssetsData: { amount: 12755802635.12, effectiveDate: '2026-09-30' }
  },
  distributions: [
    { typeCode: 'INC', amount: 0.2177, exDividendDate: '2026-10-01', recordDate: '2026-10-01', payableDate: '2026-10-05' },
    { typeCode: 'CGST', amount: 0.01, exDividendDate: '2026-10-01', recordDate: '2026-10-01', payableDate: '2026-10-05' }
  ]
});

test('normalizes API facts, preserves zeroes and source dates, and reuses distribution aggregation', () => {
  const result = normalizeFund(fund, raw());
  assert.equal(result.facts.nav, 75.52);
  assert.equal(result.facts.asOfDate, '2026-10-09');
  assert.equal(result.facts.thirtyDayYield, 0.0375);
  assert.equal(result.facts.expenseRatio, 0.0006);
  assert.equal(result.facts.weightedAverageCoupon, 0);
  assert.equal(result.facts.durationYears, 0.1);
  assert.equal(result.facts.maturityYears, 0.1);
  assert.equal(result.facts.aum, 12755802635);
  assert.equal(result.metadata.fieldDates.nav, '2026-10-12');
  assert.equal(result.metadata.fieldDates.yieldToWorst, '2026-08-31');
  assert.equal(result.distributions[0].totalDistribution, 0.2277);
  assert.equal(result.distributions[0].stcg, 0.01);
});

test('logs unavailable optional facts but rejects invalid required values and distributions', () => {
  const data = raw(), messages = [];
  delete data.fundamentals.averageCoupon;
  assert.equal(normalizeFund(fund, data, { log: message => messages.push(message) }).facts.weightedAverageCoupon, undefined);
  assert.match(messages[0], /weightedAverageCoupon unavailable/);
  data.yields.secYield.percent = 'invalid';
  assert.throws(() => normalizeFund(fund, data), /Invalid.*SEC yield/);
  data.yields.secYield.percent = '0';
  data.prices[0].effectiveDate = '2026-02-30';
  assert.throws(() => normalizeFund(fund, data), /Invalid.*NAV date/);
  data.prices[0].effectiveDate = '2026-10-12';
  data.distributions[0].typeCode = 'UNKNOWN';
  assert.throws(() => normalizeFund(fund, data), /Unknown.*distribution type/);
});

test('looks up fund IDs without a browser and collects all documented API routes', async () => {
  const urls = [], data = raw();
  const routes = { 'analytics/yields': data.yields, fees: data.fees, 'pricing/daily': data.prices,
    'pricing/distributions': data.distributions, 'analytics/fundamentals': data.fundamentals,
    'pricing/managed-assets': data.assets };
  const result = await collectFunds(['VBIL'], {
    log() {}, sleep: async () => {},
    fetchImpl: async url => {
      urls.push(url);
      const pathname = new URL(url).pathname;
      if (pathname.endsWith('/vbil')) return new Response(`<script>__INITIAL_FUND_DATA__ = ${JSON.stringify(fund)};</script>`);
      const route = pathname.split('/V042/')[1];
      assert.ok(route in routes, route);
      return new Response(JSON.stringify(routes[route]));
    }
  });
  assert.equal(urls.length, 7);
  assert.equal(result.facts.length, 1);
  assert.equal(result.prices.length, 2);
  assert.equal(result.raw.VBIL.fund.portId, 'V042');
  assert.throws(() => lookupFund('<html/>', 'VBIL'), /No __INITIAL_FUND_DATA__/);
  assert.throws(() => lookupFund(`<script>__INITIAL_FUND_DATA__ = ${JSON.stringify(fund)};</script>`, 'BND'), /ticker mismatch/);
});

test('retries rate limiting and server errors with bounds, but propagates failures', async () => {
  const waits = [];
  let attempts = 0;
  assert.equal(await requestText('https://example.invalid', {
    fetchImpl: async () => ++attempts < 3 ? new Response('', { status: 429, headers: { 'retry-after': '60' } }) : new Response('ok'),
    sleep: async delay => waits.push(delay), log() {}
  }), 'ok');
  assert.deepEqual(waits, [10000, 10000]);
  await assert.rejects(requestText('https://example.invalid', {
    fetchImpl: async () => new Response('', { status: 503 }), sleep: async () => {}, log() {}
  }), /HTTP 503/);
  await assert.rejects(requestText('https://example.invalid', {
    fetchImpl: async () => new Response('', { status: 404 })
  }), /HTTP 404/);
});

test('opt-in CLI writes isolated comparison files and leaves no outputs on collection failure', t => {
  const dir = mkdtempSync(join(tmpdir(), 'vanguard-api-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = join(dir, 'tickers.txt'), output = join(dir, 'comparison'), mock = join(dir, 'fetch.mjs');
  writeFileSync(input, 'vbil\nVBIL\n');
  writeFileSync(mock, `
const fund = ${JSON.stringify(fund)}, data = ${JSON.stringify(raw())};
const routes = {'analytics/yields':data.yields,fees:data.fees,'pricing/daily':data.prices,
'pricing/distributions':data.distributions,'analytics/fundamentals':data.fundamentals,'pricing/managed-assets':data.assets};
globalThis.fetch = async url => {
  if (process.env.VANGUARD_TEST_FAIL) return new Response('blocked', {status:403});
  const p = new URL(url).pathname;
  return new Response(p.endsWith('/vbil') ? '<script>__INITIAL_FUND_DATA__ = '+JSON.stringify(fund)+';</script>' :
    JSON.stringify(routes[p.split('/V042/')[1]]));
};
`);
  const script = fileURLToPath(new URL('../node-VanguardAdvisorsETF-api-collect.mjs', import.meta.url));
  const args = [script, '--input', input, '--output-dir', output];
  const env = { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(mock).href}` };
  const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(join(output, 'facts.json'))).length, 1);
  for (const name of ['facts', 'yields', 'prices', 'distributions', 'metadata', 'raw']) {
    assert.ok(existsSync(join(output, name + '.json')));
  }
  const failedDir = join(dir, 'failed');
  args[args.length - 1] = failedDir;
  const failed = spawnSync(process.execPath, args, {
    env: { ...env, VANGUARD_TEST_FAIL: '1' }, encoding: 'utf8'
  });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /HTTP 403/);
  assert.equal(existsSync(failedDir), false);
  args[args.length - 1] = fileURLToPath(new URL('../history/', import.meta.url));
  const protectedResult = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
  assert.equal(protectedResult.status, 1);
  assert.match(protectedResult.stderr, /must not overwrite/);
});

test('hybrid CLI rejects more than four unique tickers before launching a browser or writing outputs', t => {
  const dir = mkdtempSync(join(tmpdir(), 'vanguard-hybrid-limit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = join(dir, 'tickers.txt'), output = join(dir, 'comparison');
  writeFileSync(input, 'BND\nVTEB\nVBIL\nVTIP\nBNDW\n');
  const script = fileURLToPath(new URL('../node-VanguardAdvisorsETF-api-collect.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--hybrid', '--input', input, '--output-dir', output], {
    env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: '/nonexistent-browser' }, encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /limited to 4 tickers.*received 5/);
  assert.equal(existsSync(output), false);
});
