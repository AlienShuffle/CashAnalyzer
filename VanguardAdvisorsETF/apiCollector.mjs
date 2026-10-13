import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const base = 'https://advisors.vanguard.com/investments/products';
const headers = {
  Referer: 'https://advisors.vanguard.com',
  'User-Agent': 'Mozilla/5.0'
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function validateHybridTickerCount(tickers, hybrid) {
  if (hybrid && tickers.length > 4) {
    throw new Error(`Hybrid collection is limited to 4 tickers per run; received ${tickers.length}. Supply a smaller ticker file.`);
  }
}

export async function requestText(url, { fetchImpl = fetch, sleep = pause, log = console.error } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(45000) });
    if (response.ok) return response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10000) : (attempt + 1) * 1000;
      log(`Vanguard HTTP ${response.status}; retrying ${url} in ${delay}ms`);
      await sleep(delay);
      continue;
    }
    throw new Error(`Vanguard HTTP ${response.status} for ${url}`);
  }
}

export function lookupFund(html, ticker) {
  const match = html.match(/__INITIAL_FUND_DATA__\s*=\s*(\{.*?\})\s*;?\s*<\/script>/s);
  if (!match) throw new Error(`No __INITIAL_FUND_DATA__ for ${ticker}`);
  const fund = JSON.parse(match[1]);
  if (typeof fund.portId !== 'string' || !/^[A-Za-z0-9]+$/.test(fund.portId)) throw new Error(`Invalid Vanguard fund ID for ${ticker}`);
  if (fund.fundIdentifier?.toUpperCase() !== ticker) throw new Error(`Vanguard ticker mismatch for ${ticker}`);
  return fund;
}

function number(value, name) {
  if (value == null || String(value).trim() === '') throw new Error(`Missing ${name}`);
  const result = Number(typeof value === 'string' ? value.replace(/,/g, '') : value);
  if (!Number.isFinite(result)) throw new Error(`Invalid ${name}: ${value}`);
  return result;
}

function date(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return value;
}

export function normalizeFund(fund, raw, { timestamp = new Date().toISOString(), log = console.error, hybrid = false } = {}) {
  const ticker = fund.fundIdentifier.toUpperCase();
  const source = 'advisors.vanguard.com';
  const facts = { ticker, source, timestamp, accountType: fund.fundName };
  const fieldDates = {};
  facts.thirtyDayYield = Number((number(raw.yields?.secYield?.percent, `${ticker} SEC yield`) / 100).toFixed(4));
  facts.asOfDate = date(raw.yields.secYield.effectiveDate, `${ticker} SEC yield date`);
  fieldDates.thirtyDayYield = facts.asOfDate;
  if (!Array.isArray(raw.prices) || raw.prices.length === 0) throw new Error(`No NAV prices for ${ticker}`);
  const prices = raw.prices.map(row => ({
    ticker, source, timestamp, fundId: fund.portId,
    asOfDate: date(row.effectiveDate, `${ticker} NAV date`),
    price: number(row.price, `${ticker} NAV`)
  }));
  if (prices.some(row => row.price <= 0)) throw new Error(`Invalid nonpositive NAV for ${ticker}`);
  const latest = prices.reduce((a, b) => a.asOfDate > b.asOfDate ? a : b);
  facts.nav = latest.price;
  fieldDates.nav = latest.asOfDate;
  for (const [field, entry, key, percent, digits] of [
    ['distributionYield', raw.yields.distributionYield, 'percent', true, 4],
    ['yieldToMaturity', raw.yields.yieldToMaturity, 'percent', true, 4],
    ['yieldToWorst', raw.yields.yieldToWorst, 'percent', true, 4],
    ['expenseRatio', raw.fees?.adjustedExpenseRatio, 'value', true, 6],
    ['durationYears', raw.fundamentals?.averageDuration, 'value', false, 2],
    ['maturityYears', raw.fundamentals?.averageEffectiveMaturity, 'value', false, 2],
    ['weightedAverageCoupon', raw.fundamentals?.averageCoupon, 'value', true, 5],
    ['aum', raw.assets?.fundNetAssetsData, 'amount', false, 0]
  ]) {
    if (hybrid && field !== 'distributionYield') continue;
    if (entry?.[key] == null || entry[key] === '') {
      log(`Vanguard API ${ticker}: ${field} unavailable`);
      continue;
    }
    facts[field] = Number((number(entry[key], `${ticker} ${field}`) / (percent ? 100 : 1)).toFixed(digits));
    if (entry.effectiveDate) fieldDates[field] = date(entry.effectiveDate, `${ticker} ${field} date`);
  }
  if (!Array.isArray(raw.distributions)) throw new Error(`Invalid distributions for ${ticker}`);
  for (const row of raw.distributions) {
    if (!['INC', 'CGLT', 'CGST', 'ROC'].includes(row.typeCode)) throw new Error(`Unknown ${ticker} distribution type: ${row.typeCode}`);
    number(row.amount, `${ticker} distribution amount`);
    for (const field of ['exDividendDate', 'recordDate', 'payableDate']) date(row[field], `${ticker} ${field}`);
  }
  let distributions = [];
  if (raw.distributions.length) {
    const parser = fileURLToPath(new URL('./node-VanguardAdvisorsETF-distro-update.js', import.meta.url));
    const result = spawnSync(process.execPath, [parser, ticker], {
      input: JSON.stringify(raw.distributions), encoding: 'utf8'
    });
    if (result.status !== 0) throw new Error(`Distribution parser failed for ${ticker}: ${result.error?.message || result.stderr}`);
    distributions = JSON.parse(result.stdout).map(row => ({ ...row, timestamp }));
  } else {
    log(`Vanguard API ${ticker}: no distribution history`);
  }
  return {
    facts, prices,
    yields: { ticker, source, timestamp, asOfDate: facts.asOfDate, thirtyDayYield: facts.thirtyDayYield, nav: facts.nav },
    distributions,
    metadata: { ticker, fundId: fund.portId, fieldDates }
  };
}

export async function collectFunds(tickers, options = {}) {
  validateHybridTickerCount(tickers, options.hybrid);
  const sleep = options.sleep || pause;
  const log = options.log || console.error;
  const results = { facts: [], prices: [], yields: [], distributions: [], metadata: [], raw: {} };
  for (const [index, ticker] of tickers.entries()) {
    if (!/^[A-Z0-9.-]+$/.test(ticker)) throw new Error(`Invalid ticker: ${ticker}`);
    if (index) await sleep(1000);
    log(`Collecting Vanguard API fund: ${ticker}`);
    const fund = lookupFund(await requestText(`${base}/${ticker.toLowerCase()}`, options), ticker);
    const routes = {
      yields: 'analytics/yields',
      fees: 'fees',
      prices: 'pricing/daily?priceTypeCode=NAV&inceptionDate=2000-11-13',
      distributions: 'pricing/distributions?hasDistributionYield=false',
      fundamentals: 'analytics/fundamentals',
      assets: 'pricing/managed-assets'
    };
    if (options.hybrid) {
      delete routes.fees;
      delete routes.fundamentals;
      delete routes.assets;
    }
    const raw = { fund };
    for (const [name, route] of Object.entries(routes)) {
      const url = `${base}/api/funds/${fund.portId}/${route}`;
      const text = await requestText(url, options);
      try {
        raw[name] = JSON.parse(text);
      } catch (error) {
        throw new Error(`Invalid Vanguard JSON for ${url}: ${error.message}`);
      }
    }
    const normalized = normalizeFund(fund, raw, options);
    if (options.hybrid) {
      if (typeof options.scrapeDailyYields !== 'function') throw new Error('Hybrid collector requires a daily-yield scraper');
      const daily = await options.scrapeDailyYields(ticker);
      raw.dailyYields = daily;
      for (const field of ['yieldToMaturity', 'yieldToWorst']) {
        if (daily.values[field] !== undefined) {
          normalized.facts[field] = number(daily.values[field], `${ticker} daily ${field}`);
          normalized.metadata.fieldDates[field] = date(daily.asOfDate, `${ticker} daily yield date`);
        } else {
          log(`Vanguard daily page ${ticker}: ${field} unavailable; older API value not used`);
        }
      }
    }
    for (const key of ['facts', 'prices', 'yields', 'distributions', 'metadata']) {
      results[key].push(...(Array.isArray(normalized[key]) ? normalized[key] : [normalized[key]]));
    }
    results.raw[ticker] = raw;
  }
  return results;
}
