// Banks.gs - get current apy rates for various bank products.
// v98 - works fully after adding backend puppeter support.
// v99 - reworked Bank API to be generic one entry point for all banks.
// v114 - moved to cloudFlare

/**
 * Function to returns latest Bank Savings Rate looking in the cache first. This pulled
 * from readngtndude's Google Drive folder where a json file is updated daily using a
 * scheduled script run off a locally managed computer.
 * returns [[asOfDate, rate]]
 * 
 * @param {string} bank Institution {"Ally"=, "Vanguard"}.
 * @param {string} account account type, varies {"Savings"=, "Checking"}.
 * @param {boolean} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @returns {[[date,float]]}
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
 * Function to returns latest Bank Savings Rate for accounts in the bank looking in the cache first. This pulled
 * from readngtndude's Google Drive folder where a json file is updated daily using a
 * scheduled script run off a locally managed computer.
 * returns [[asOfDate, rate]]
 * 
 * @param {string} bank Institution {"Ally"=, "Vanguard"}.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @returns {[[date,float]]}
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
  if (resp.length < 1) throw 'No content found for: ' + bank + '-' + account;

  // parse apy and asOfDate.
  const data = JSON.parse(resp);
  let results = [];
  for (var i = 0; i < data.length; i++) {
    let apy = data[i].apy * 1;
    if (apy) results.push([data[i].accountType, duGetDateFromYYYYMMDD_(data[i].asOfDate), apy]);
  }
  results.sort((a, b) => a[0].localeCompare(b[0]));
  return results;
}

/**
 * This retrieves a list of account Types currently recorded in the rates file.
 * @param {string} bank Institution {"Ally"=, "Vanguard"}.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [accountTypes] list of entries.
 * @customfunction
 */
function bankGetCachedAccounTypes(bank, forceRefresh = false) {
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
    throw 'No content found for: ' + bank + '-' + account;

  const data = JSON.parse(banks);
  let resp = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i].apy > 0) resp.push(data[i].accountType);
  }
  resp.sort();

  // log TTL calculations.
  const ttl = cacheCalcTTLAfterHour_(7);
  cacheLogTTL_(cacheKey, new Date, ttl);
  cache.set(cacheKey, JSON.stringify(resp), ttl);

  return resp;
}

/**
 * This retrieves the unprocessed contents of a bank rate file.
 * This is here primarily to allow a file to be retrieved without knowledge of where or how the file is stored.
 * JSON structure is well defined though.
 *
 * @param {string} bank bank name.
 * @return JSON list of entries.
 * @customfunction
 */
function bankGetCurrentRateFileContents(bank) {
  try {
    return cloudGetFileContents_('Banks/' + bank + '/' + bank + '-rate.json');
  } catch (err) {
    throw 'failed: retrieve ' + bank + '-rate.json file: ' + err.message;
  }
}