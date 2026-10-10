// Banks.RateHistory.gs - get historical APY rates for various bank products.
// v99 - reworked Bank API to be generic one entry point for all banks.
// v103 - added bankGetCachedRateHistoryDates
// v114 - moved to cloudFlare 
// v115 - error handling for bad bank/account pairs.
// v127 - update to Banks v2 (split out each accountType's history into individual files)

/**
 * Returns Cash Optimizer bank APY history in ascending date order, using the script cache.
 * No header; APYs are decimals (0.04 = 4%). Throws when no matching history exists.
 * Example: =bankGetCachedRateHistory("Ally", "Savings", DATE(2026,1,1), DATE(2026,10,10))
 * @param {string} bank Bank source name.
 * @param {string} account Exact account type.
 * @param {Date|string} start_date Inclusive first date.
 * @param {Date|string} end_date Inclusive last date.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number>>} Rows: [asOfDate, APY].
 * @customfunction
 */
function bankGetCachedRateHistory(bank, account, start_date, end_date, forceRefresh = false) {
  const cacheKey = "bankGetRateHistory-v128-" + bank + '-' + account + start_date + '-' + end_date;
  const cache = new Cacher({
    cachePoint: CacheService.getScriptCache()
  })

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);

    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      const cacheArray = JSON.parse(cacheVal);
      for (const i in cacheArray) {
        if (cacheArray[i] != null && cacheArray[i][0])
          cacheArray[i][0] = new Date(cacheArray[i][0]);
      }
      return cacheArray;
    }
  }

  // internal function that does the query and retrieval.
  function bankGetRateHistory(bank, account, start_date, end_date) {

    // breaks up date ranges into ranges that all include a single year. returns an array of date pairs.
    function archiveDateYearPairs_(sDateStart, sDateEnd) {
      const dStart = new Date(sDateStart);
      const dEnd = new Date(sDateEnd);
      const startYear = dStart.getFullYear();
      const endYear = dEnd.getFullYear();
      const yearCount = endYear - startYear;
      if (!Number.isFinite(dStart.getTime()) || !Number.isFinite(dEnd.getTime())) {
        throw new Error('Invalid bank history date range');
      }

      let datePairs = [];
      if (yearCount < 0 || dEnd < dStart) {
        throw 'Start Date (' + sDateStart + ') after End Date ' + sDateEnd;
      } else if (yearCount == 0) {
        datePairs.push([dStart, dEnd]);
      } else if (yearCount == 1) {
        datePairs.push([dStart, new Date(startYear, 11, 31)]);
        datePairs.push([new Date(endYear, 0, 1), dEnd]);
      } else {
        datePairs.push([dStart, new Date(startYear, 11, 31)]);
        for (let i = 1; i < yearCount; i++) {
          datePairs.push([new Date(startYear + i, 0, 1), new Date(startYear + i, 11, 31)]);
        }
        datePairs.push([new Date(endYear, 0, 1), dEnd]);
      }
      return datePairs;
    }

    const aDateStringPairs = archiveDateYearPairs_(start_date, end_date);
    const resp = bankGetCurrentRateHistoryFileContents(bank, account);
    const json = JSON.parse(resp);

    let result = [];
    for (const dates in aDateStringPairs) {
      for (let r in json) {
        if (json[r].accountType != account) continue;
        const jsonDate = duGetDateFromYYYYMMDD_(json[r].asOfDate);
        if (jsonDate >= aDateStringPairs[dates][0] && jsonDate <= aDateStringPairs[dates][1]) {
          let row = [];
          row[0] = jsonDate;
          if (safeObjectRef_(json[r].apy)) {
            row[1] = json[r].apy * 1;
            result.push(row);
          }
        }
      }
    }
    result.sort((a, b) => a[0] - b[0] || a[1] - b[1]);;
    return result;
  }

  const resp = bankGetRateHistory(bank, account, start_date, end_date);
  // check if we found anything to return.
  if (resp.length < 1)
    throw new Error('No bank history for ' + bank + '/' + account + ' in the requested date range');

  // set ttl for 7AM as the tickers normally are not updated after 7AM. A user could force a refresh if necessary.
  const ttl = cacheCalcTTLAfterHour_(7);
  cacheLogTTL_(cacheKey, new Date, ttl);
  cache.set(cacheKey, JSON.stringify(resp), { expiry: ttl });
  return resp;
}

/**
 * Returns the available Cash Optimizer APY history date range, using the script cache.
 * Throws for an unknown bank/account pair. No header.
 * Example: =bankGetCachedRateHistoryDates("Ally", "Savings")
 * @param {string} bank Bank source name.
 * @param {string} account Exact account type.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date>>} One row: [[oldestDate, newestDate]].
 * @customfunction
 */
function bankGetCachedRateHistoryDates(bank, account, forceRefresh = false) {
  const cacheKey = "bankGetRateHistoryDates-v128-" + bank + '-' + account;
  const cache = new Cacher({
    cachePoint: CacheService.getScriptCache()
  })

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);

    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      const cacheArray = JSON.parse(cacheVal);
      for (let i = 0; i < 2; i++) {
        if (cacheArray[0][i] != null && cacheArray[0][i])
          cacheArray[0][i] = new Date(cacheArray[0][i]);
      }
      return cacheArray;
    }
  }

  const resp = bankGetRateHistoryDates_(bank, account);
  // check if we found anything to return.
  if (resp.length < 1)
    return;

  // set ttl for 7AM as the tickers normally are not updated after 7AM. A user could force a refresh if necessary.
  const ttl = cacheCalcTTLAfterHour_(7);
  cacheLogTTL_(cacheKey, new Date, ttl);
  cache.set(cacheKey, JSON.stringify(resp), { expiry: ttl });
  return resp;
}

// internal function that does the query and retrieval.
function bankGetRateHistoryDates_(bank, account) {

  const resp = bankGetCurrentRateHistoryFileContents(bank, account);
  const json = JSON.parse(resp);

  let oldestDate;
  let newestDate;
  let accountFound = false;

  for (let r in json) {
    if (json[r].accountType != account) continue;
    if (!safeObjectRef_(json[r].apy)) continue;
    accountFound = true;
    const jsonDate = duGetDateFromYYYYMMDD_(json[r].asOfDate);
    if (!newestDate || jsonDate > newestDate) {
      newestDate = jsonDate;
    }
    if (!oldestDate || jsonDate < oldestDate) {
      oldestDate = jsonDate;
    }
  }
  if (!accountFound) throw 'bankGetRateHistoryDates_(' + bank + ',' + account + '): bank/account pair not found.';
  return [[oldestDate, newestDate]];
}

// ---- This section is the internal control for retrieving cloudflare files with the data.
/**
 * Fetches raw Cash Optimizer bank/account APY history JSON without caching.
 * Entries contain accountType, asOfDate, and decimal apy. Tries legacy paths if needed.
 * Example: =bankGetCurrentRateHistoryFileContents("Ally", "Savings")
 * @param {string} bank Bank source name.
 * @param {string} account Required account type.
 * @return {string} JSON text, not parsed objects. Throws if all retrieval attempts fail.
 * @customfunction
 */
function bankGetCurrentRateHistoryFileContents(bank, account) {
  if (typeof bank !== 'string' || !bank.trim()) throw new Error('Bank name is required');
  if (typeof account !== 'string' || !account.trim()) throw new Error('Bank account type is required');
  let path = 'Banks/' + bank + '/history/' + account.replaceAll(' ', '-') + '/rate-history.json';
  try {
    const contents = cloudGetFileContents_(path);
    if (contents.length > 0) return contents;
    Logger.log('empty or not found: ' + path);
  } catch (err) {
    Logger.log('failed: retrieve ' + path + ': ' + (err.message || String(err)));
  }
  // if that fails, look in the base folder (no history) for account.
  path = 'Banks/' + bank + '/' + account.replaceAll(' ', '-') + '/rate-history.json';
  try {
    const contents = cloudGetFileContents_(path);
    if (contents.length > 0) return contents;
    Logger.log('empty or not found: ' + path);
  } catch (err) {
    Logger.log('failed: retrieve ' + path + ': ' + (err.message || String(err)));
  }
  // If the file does not exist in the new format, look for it in the old format (this allows a transition).
  path = 'Banks/' + bank + '/' + bank + '-history.json'
  try {
    const contents = cloudGetFileContents_(path);
    if (contents.length > 0) return contents;
    Logger.log('empty or not found: ' + path);
  } catch (err) {
    throw new Error('Failed to retrieve ' + path + ': ' + (err.message || String(err)));
  }
}

/**
 * Returns available bank source names from Cash Optimizer's Banks/bank-list.txt.
 * Uses the script cache. The source is a newline-separated list, not fund history.
 * Example: =bankCachedAvailableBanks()
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<string>>} One bank name per row; no header.
 * @customfunction
 */
function bankCachedAvailableBanks(forceRefresh = false) {
  const cacheKey = "bankAvailableBanks-v157";
  const cache = new Cacher({
    cachePoint: CacheService.getScriptCache()
  });

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);

    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      const cacheArray = JSON.parse(cacheVal);
      return cacheArray;
    }
  }

  function bankAvailableBanks() {
    let file;
    try {
      file = cloudGetFileContents_('Banks/bank-list.txt');
    } catch (err) {
      throw new Error('Failed to retrieve Banks/bank-list.txt: ' + (err.message || String(err)));
    }
    const matrix = file.trim().split(/\r?\n/).map(bank => [bank.trim()]).filter(row => row[0]);
    var data = [];
    for (let i = 0; i < matrix.length; i++) {
      data.push(matrix[i]);
    }
    return data;
  }

  const resp = bankAvailableBanks();

  // set ttl for 7am.
  const ttl = cacheCalcTTLAfterHour_(7);
  cacheLogTTL_(cacheKey, new Date, ttl);
  cache.set(cacheKey, JSON.stringify(resp), { expiry: ttl });
  return resp;
}