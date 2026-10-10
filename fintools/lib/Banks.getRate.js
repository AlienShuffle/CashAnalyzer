// Banks.gs - get current apy rates for various bank products.
// v98 - works fully after adding backend puppeter support.
// v99 - reworked Bank API to be generic one entry point for all banks.
// v114 - moved to cloudFlare

/**
 * Returns the latest bank APY from Cash Optimizer, using the script cache.
 * No header. APY is a decimal (0.04 = 4%). Throws for an unknown account or missing rate.
 * Example: =bankGetCachedRate("Ally", "Savings")
 * @param {string} bank Bank source name; see bankCachedAvailableBanks.
 * @param {string} account Account type, matched case-insensitively.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number>>} One row: [[asOfDate, APY]].
 * @customfunction
 */
function bankGetCachedRate(bank, account, forceRefresh = false) {
  const cacheKey = bank + '-Rate-v128-' + account;
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      let cacheArray = JSON.parse(cacheVal);
      // convert JSON string date back to a javascript date. Man, dates are annoying.
      if (cacheArray[0][0])
        cacheArray[0][0] = new Date(cacheArray[0][0]);
      return cacheArray;
    }
  }

  // Don't have a cached quote, so go out and get one.
  const resp = bankGetRate_(bank, account);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

function bankGetRate_(bank, account) {
  if (!bank)
    throw 'Function bankGetRate_ parameter 1 expects a valid bank, but no bank was provided.';
  if (!account)
    throw 'Function bankGetRate_ parameter 2 expects a valid account, but no account was provided.';

  const resp = bankGetCurrentRateFileContents(bank);
  if (resp.length < 1)
    throw 'No content found for: ' + bank + '-' + account;

  // parse apy and asOfDate.
  const data = JSON.parse(resp);
  let apy = 0;
  let asOfDate = '';
  for (var i = 0; i < data.length; i++) {
    if (data[i].accountType.toLowerCase() == account.toLocaleLowerCase()) {
      apy = data[i].apy;
      asOfDate = duGetDateFromYYYYMMDD_(data[i].asOfDate);
      break;
    }
  }
  if (!asOfDate) throw 'Invalid account type: ' + bank + '-' + account;

  if (isNaN(apy)) {
    throw 'Element \"' + apy + '\" found in rate position is not a number.';
  } else {
    // Blank rate will get converted to 0.
    if (apy == 0)
      throw 'No rate found for account: ' + bank + '-' + account;
  }
  return [[asOfDate, apy]];
}

/**
 * Returns nonzero account APYs from Cash Optimizer, sorted by account type.
 * Uses the script cache; no header. APYs are decimals (0.04 = 4%).
 * Example: =bankGetCachedAllRates("Ally")
 * @param {string} bank Bank source name.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<string|Date|number>>} Rows: [accountType, asOfDate, APY].
 * @customfunction
 */
function bankGetCachedAllRates(bank, forceRefresh = false) {
  const cacheKey = bank + '-bankGetCachedAllRates-v128-';
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      let cacheArray = JSON.parse(cacheVal);
      // convert JSON string date back to a javascript date. Man, dates are annoying.
      for (let i = 0; i < cacheArray.length; i++) {
        if (cacheArray[i][1])
          cacheArray[i][1] = new Date(cacheArray[i][1]);
      }
      return cacheArray;
    }
  }

  // Don't have a cached quote, so go out and get one.
  const resp = bankGetAllRates_(bank);

  // log TTL calculations.
  const tradetime = resp[0][1];
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

function bankGetAllRates_(bank) {
  if (!bank) throw 'Function bankGetRate_ parameter 1 expects a valid bank, but no bank was provided.';
  const resp = bankGetCurrentRateFileContents(bank);
  if (resp.length < 1) throw new Error('No content found for bank: ' + bank);

  // parse apy and asOfDate.
  const data = JSON.parse(resp);
  let results = [];
  for (var i = 0; i < data.length; i++) {
    let apy = data[i].apy * 1;
    if (apy) results.push([data[i].accountType, duGetDateFromYYYYMMDD_(data[i].asOfDate), apy]);
  }
  results.sort((a, b) => a[0].localeCompare(b[0]));
  if (!results.length) throw new Error('No rates found for bank: ' + bank);
  return results;
}

/**
 * Compatibility alias for bankGetCachedAccountTypes; retains the original misspelling.
 * @param {string} bank Bank source name.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<string>} Sorted account types with positive APYs; no header.
 * @customfunction
 */
function bankGetCachedAccounTypes(bank, forceRefresh = false) {
  return bankGetCachedAccountTypes(bank, forceRefresh);
}

/**
 * Returns account types with positive APYs from Cash Optimizer, using the script cache.
 * Example: =bankGetCachedAccountTypes("Ally")
 * @param {string} bank Bank source name.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<string>} Sorted account types; no header.
 * @customfunction
 */
function bankGetCachedAccountTypes(bank, forceRefresh = false) {
  const cacheKey = 'bankGetCachedAccounTypes-v128-' + bank;
  const cache = new Cacher({
    cachePoint: CacheService.getScriptCache()
  });

  if (!bank)
    throw 'Function bankGetRate_ parameter 1 expects a valid bank, but no bank was provided.';

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);

    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      return JSON.parse(cacheVal);
    }
  }

  const banks = bankGetCurrentRateFileContents(bank);
  if (banks.length < 1)
    throw new Error('No content found for bank: ' + bank);

  const data = JSON.parse(banks);
  let resp = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i].apy > 0) resp.push(data[i].accountType);
  }
  resp.sort();

  // log TTL calculations.
  const ttl = cacheCalcTTLAfterHour_(7);
  cacheLogTTL_(cacheKey, new Date, ttl);
  cache.set(cacheKey, JSON.stringify(resp), { expiry: ttl });

  return resp;
}

/**
 * Fetches raw Cash Optimizer bank-rate JSON text, without caching.
 * Entries contain accountType, asOfDate, and decimal apy. Throws on retrieval failure.
 * Example: =bankGetCurrentRateFileContents("Ally")
 * @param {string} bank Bank source name.
 * @return {string} JSON text, not parsed objects.
 * @customfunction
 */
function bankGetCurrentRateFileContents(bank) {
  if (typeof bank !== 'string' || !bank.trim()) throw new Error('Bank name is required');
  try {
    return cloudGetFileContents_('Banks/' + bank + '/' + bank + '-rate.json');
  } catch (err) {
    throw new Error('Failed to retrieve ' + bank + '-rate.json: ' + (err.message || String(err)));
  }
}