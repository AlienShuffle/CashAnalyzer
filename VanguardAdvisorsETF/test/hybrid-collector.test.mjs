import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDailyYields } from '../dailyYields.mjs';
import { collectFunds, validateHybridTickerCount } from '../apiCollector.mjs';

test('hybrid allows four tickers and rejects five before any provider requests', async () => {
  assert.doesNotThrow(() => validateHybridTickerCount(['BND', 'VTEB', 'VBIL', 'VTIP'], true));
  assert.doesNotThrow(() => validateHybridTickerCount(['BND', 'VTEB', 'VBIL', 'VTIP', 'BNDW'], false));
  await assert.rejects(collectFunds(['BND', 'VTEB', 'VBIL', 'VTIP', 'BNDW'], {
    hybrid: true,
    fetchImpl: async () => assert.fail('must not request provider'),
    scrapeDailyYields: async () => assert.fail('must not scrape')
  }), /limited to 4 tickers.*received 5/);
});

test('daily parser extracts only dated YTM/YTW, preserving zero and omitting missing yields', () => {
  assert.deepEqual(parseDailyYields('Fundamentals as of 10/09/2026 Daily Monthly Yield to maturity 0.00% Yield to worst 5.49% Average coupon 3.94%').values,
    { yieldToMaturity: 0, yieldToWorst: 0.0549 });
  assert.deepEqual(parseDailyYields('Fundamentals as of 10/09/2026 Daily Yield to worst4.70%').values,
    { yieldToWorst: 0.047 });
  assert.throws(() => parseDailyYields('Daily Yield to maturity 5%'), /date not found/);
  assert.throws(() => parseDailyYields('as of 02/30/2026 Daily Yield to maturity 5%'), /Invalid daily/);
  assert.throws(() => parseDailyYields('as of 10/09/2026 Monthly Yield to maturity 5%'), /Daily.*not found/);
});

test('hybrid requests only priority APIs and replaces stale API YTM/YTW with dated daily values', async () => {
  const urls = [], messages = [];
  const fund = { portId: '0584', fundIdentifier: 'BND', fundName: 'Total Bond Market ETF' };
  const payloads = {
    'analytics/yields': { secYield: { percent: '5.13', effectiveDate: '2026-10-09' },
      yieldToMaturity: { percent: '5.01', effectiveDate: '2026-08-31' },
      yieldToWorst: { percent: '5.00', effectiveDate: '2026-08-31' } },
    'pricing/daily': [{ price: 70.21, effectiveDate: '2026-10-12' }],
    'pricing/distributions': [{ typeCode: 'INC', amount: 0.25, exDividendDate: '2026-10-01',
      recordDate: '2026-10-01', payableDate: '2026-10-05' }]
  };
  const options = {
    hybrid: true, log: message => messages.push(message),
    fetchImpl: async url => {
      urls.push(url);
      if (url.endsWith('/bnd')) return new Response(`<script>__INITIAL_FUND_DATA__ = ${JSON.stringify(fund)};</script>`);
      const route = new URL(url).pathname.split('/0584/')[1];
      assert.ok(route in payloads, route);
      return new Response(JSON.stringify(payloads[route]));
    },
    scrapeDailyYields: async () => parseDailyYields('Fundamentals as of 10/09/2026 Daily Yield to maturity5.49% Yield to worst5.49%')
  };
  const result = await collectFunds(['BND'], options);
  assert.equal(urls.length, 4);
  assert.equal(result.facts[0].yieldToMaturity, 0.0549);
  assert.equal(result.facts[0].yieldToWorst, 0.0549);
  assert.equal(result.facts[0].expenseRatio, undefined);
  assert.equal(result.facts[0].aum, undefined);
  assert.equal(result.metadata[0].fieldDates.yieldToMaturity, '2026-10-09');
  assert.equal(result.distributions[0].totalDistribution, 0.25);
  options.scrapeDailyYields = async () => ({ values: {}, asOfDate: null });
  const missing = await collectFunds(['BND'], options);
  assert.equal(missing.facts[0].yieldToMaturity, undefined);
  assert.equal(missing.facts[0].yieldToWorst, undefined);
  assert(messages.some(message => /older API value not used/.test(message)));
  options.scrapeDailyYields = async () => { throw new Error('navigation failed'); };
  await assert.rejects(collectFunds(['BND'], options), /navigation failed/);
});
