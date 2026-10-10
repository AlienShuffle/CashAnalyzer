bankGetCachedRateHistory// Banks.RateHistory.gs - get historical APY rates for various bank products.
// v99 - reworked Bank API to be generic one entry point for all banks.
// v103 - added bankGetCachedRateHistoryDates
// v114 - moved to cloudFlare 
// v115 - error handling for bad bank/account pairs.
// v127 - update to Banks v2 (split out each accountType's history into individual files)

/**
 * Retrieve bank rate (APY) history for a bank account. This will use cached values if available.
 * Caching improves user experience and spreadsheet performance, but does not update the quotes as often,
 * causing mild delays in data in some cases. Not an issues with Price Yield History.
 * Returns a matrix with each row including
 * {[date, float, ]} [date, apy]
 * as an array returned from the fintools bank database.
 *
 * @param {string} bank Institution {"Ally"=, "Vanguard"}.
 * @param {string} account account type, varies {"Savings"=, "Checking"}.
 * @param {date} start_date First date for which to retrieve price and yield.
 * @param {date} end_date Last date for which to retrieve price and yield.
 * @param {false} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[asOfDate, apy]].
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
      for (i in cacheArray) {
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
    return;

  // set ttl for 7AM as the tickers normally are not updated after 7AM. A user could force a refresh if necessary.
  const ttl = cacheCalcTTLAfterHour_(7);
  cacheLogTTL_(cacheKey, new Date, ttl);
  cache.set(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Retrieve date range for the bank rate (APY) history for a bank acount. 
 * [date, date]
 * as an array returned from the fintools bank database.
 *
 * @param {string} bank Institution {"Ally"=, "Vanguard"}.
 * @param {string} account account type, varies {"Savings"=, "Checking"}
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [oldestDate, newestDate]
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
  cache.set(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

// internal function that does the query and retrieval.
function bankGetRateHistoryDates_(bank, account) {

  const resp = bankGetCurrentRateHistoryFileContents(bank, account);
  const json = JSON.parse(resp);

  let oldestDate = new Date;
  let newestDate = new Date("1/1/2000");
  let accountFound = false;

  for (let r in json) {
    if (json[r].accountType != account) continue;
    if (!safeObjectRef_(json[r].apy)) continue;
    accountFound = true;
    const jsonDate = duGetDateFromYYYYMMDD_(json[r].asOfDate);
    if (jsonDate > newestDate) {
      newestDate = jsonDate;
    }
    if (jsonDate < oldestDate) {
      oldestDate = jsonDate;
    }
  }
  if (!accountFound) throw 'bankGetRateHistoryDates_(' + bank + ',' + account + '): bank/account pair not found.';
  return [[oldestDate, newestDate]];
}

// ---- This section is the internal control for retrieving cloudflare files with the data.
/**
 * This retrieves the unprocessed contents of a bank rate history file.
 * This is here primarily to allow a file to be retrieved without knowledge of where or how the file is stored.
 * JSON structure is well defined though.
 *
 * @param {string} bank bank to query
 * @param {string} account bank account within the bank to query (new added in v127)
 * @return file contents.
 * @customfunction
 */
function bankGetCurrentRateHistoryFileContents(bank, account) {
  let path = 'Banks/' + bank + '/history/' + account.replaceAll(' ', '-') + '/rate-history.json';
  try {
    const contents = cloudGetFileContents_(path);
    if (contents.length > 0) return contents;
    Logger.log('empty or not found: ' + path);
  } catch (err) {
    Logger.log('failed: retrieve ' + path + ': ' + err.message);
  }
  // if that fails, look in the base folder (no history) for account.
  path = 'Banks/' + bank + '/' + account.replaceAll(' ', '-') + '/rate-history.json';
  try {
    const contents = cloudGetFileContents_(path);
    if (contents.length > 0) return contents;
    Logger.log('empty or not found: ' + path);
  } catch (err) {
    Logger.log('failed: retrieve ' + path + ': ' + err.message);
  }
  // If the file does not exist in the new format, look for it in the old format (this allows a transition).
  path = 'Banks/' + bank + '/' + bank + '-history.json'
  try {
    const contents = cloudGetFileContents_(path);
    if (contents.length > 0) return contents;
    Logger.log('empty or not found: ' + path);
  } catch (err) {
    throw 'failed: retrieve ' + path + ': ' + err.message;
  }
}

/**
 * Retrieve an array of available money market fund tickers from the bank database. 
 * This function cache's results.
 * returns an array of the following values: [[ticker, year-of-results, start-date, end-date]]
 * There will be one row for each year that a fund is bankd.
 *
 * @param {false} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[ticker, year-of-results, start-date, end-date]
 * @customfunction
 */
function bankCachedAvailableBanks(forceRefresh = false) {
  const cacheKey = "bankAvailableTickers-v128";
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
      throw 'failed: retrieve Banks/bank-listtxt file: ' + err.message;
    }
    const matrix = csvToMatrix_(file);
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
  cache.set(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}