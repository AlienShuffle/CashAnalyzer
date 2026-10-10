// cloudHistory.gs
// v135 - migrate from mmHistory to cloudFlare version.

/**
 * Returns the latest Cash Optimizer money-market yields found in the last five days.
 * Uses the document cache when available, otherwise the script cache. No header.
 * Yields are decimals (0.04 = 4%); unavailable yield columns are empty strings.
 * Throws if the search window has no data or retrieval fails.
 * Example: =cloudGetCachedYieldFromHistory("SPAXX")
 * @param {string} ticker Fund ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number|string>>} One row: [[date, oneDay, sevenDay, thirtyDay]].
 * @customfunction
 */
function cloudGetCachedYieldFromHistory(ticker, forceRefresh = false) {
  const eDate = new Date;
  const sDate = duGetDateDelta_(eDate, -5);
  const yields = cloudGetCachedYieldHistory(ticker, sDate, eDate, false, forceRefresh);
  if (yields.length) {
    const index = yields.length - 1;
    return [[yields[index][0], yields[index][1], yields[index][2], yields[index][3]]];
  } else {
    throw new Error('No yield history for ' + ticker + ' in the last five days');
  }
}

/**
 * Returns Cash Optimizer one-day decimal yields in ascending date order, without a header.
 * Gaps between observations carry the previous yield; unavailable yields are empty strings.
 * Example: =cloudGetCachedOneDayYieldHistory("SPAXX", DATE(2026,1,1), DATE(2026,10,10))
 * @param {string} ticker Fund ticker.
 * @param {Date|string} start_date Inclusive first date.
 * @param {Date|string} end_date Inclusive last date.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number|string>>} Rows: [date, oneDayYield]. Throws if no data.
 * @customfunction
 */
function cloudGetCachedOneDayYieldHistory(ticker, start_date, end_date, forceRefresh = false) {
  const yields = cloudGetCachedYieldHistory(ticker, start_date, end_date, false, forceRefresh);
  if (yields) {
    const resp = yields.map(function (value) { return [value[0], value[1]] });
    return resp;
  } else {
    throw ticker + "failed retrieval";
  }
}

/**
 * Returns Cash Optimizer seven-day decimal yields in ascending date order, without a header.
 * Gaps between observations carry the previous yield; unavailable yields are empty strings.
 * Example: =cloudGetCachedSevenDayYieldHistory("SPAXX", DATE(2026,1,1), DATE(2026,10,10))
 * @param {string} ticker Fund ticker.
 * @param {Date|string} start_date Inclusive first date.
 * @param {Date|string} end_date Inclusive last date.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number|string>>} Rows: [date, sevenDayYield]. Throws if no data.
 * @customfunction
 */
function cloudGetCachedSevenDayYieldHistory(ticker, start_date, end_date, forceRefresh = false) {
  const yields = cloudGetCachedYieldHistory(ticker, start_date, end_date, false, forceRefresh);
  if (yields) {
    const resp = yields.map(function (value) { return [value[0], value[2]] });
    return resp;
  } else {
    throw ticker + "failed retrieval";
  }
}


/**
 * Returns the available Cash Optimizer yield history date range, without a header.
 * Uses the document cache when available, otherwise the script cache.
 * Retrieval/parse failures propagate; missing history throws rather than returning error text.
 * Example: =cloudGetCachedYieldHistoryRange("SPAXX")
 * @param {string} ticker Fund ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date>>} One row: [[oldestDate, newestDate]].
 * @customfunction
 */
function cloudGetCachedYieldHistoryRange(ticker, forceRefresh = false) {
  const cacheKey = "cloudGetYieldHistoryRange-v157-" + ticker;
  const cache = new Cacher({
    cachePoint: CacheService.getDocumentCache() || CacheService.getScriptCache()
  })

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      if (cacheArray[0] != null && cacheArray[0][0])
        cacheArray[0][0] = new Date(cacheArray[0][0]);
      if (cacheArray[0] != null && cacheArray[0][1])
        cacheArray[0][1] = new Date(cacheArray[0][1]);
      return cacheArray;
    }
  }

  const resp = cloudGetYieldHistoryRange_(ticker);

  const ttl = cacheCalcTTLAfterHour_(6);
  cacheLogTTL_(cacheKey, new Date, ttl);
  cache.set(cacheKey, JSON.stringify(resp), { expiry: ttl });
  return resp;
}

// internal function that does the query and retrieval.
function cloudGetYieldHistoryRange_(ticker) {
  const json = cloudGetSortedYieldHistory_(ticker);
  return [[
    duGetDateFromYYYYMMDD_(json[0].asOfDate),
    duGetDateFromYYYYMMDD_(json[json.length - 1].asOfDate)
  ]];
}

/**
 * Returns Cash Optimizer yield history in ascending date order.
 * Gaps between observations within the requested range carry previous yields;
 * filled rows are not independent observations. Yields are decimals, missing values empty strings.
 * Uses the document cache when available, otherwise the script cache. Throws if no data.
 * Example: =cloudGetCachedYieldHistory("SPAXX", DATE(2026,1,1), DATE(2026,10,10))
 * @param {string} ticker Fund ticker.
 * @param {Date|string} start_date Inclusive first date.
 * @param {Date|string} end_date Inclusive last date.
 * @param {boolean} [includeHeader=true] Prepend As Of Date, 1-day Yield, 7-day Yield, 30-day Yield.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number|string>>} Rows: [date, oneDay, sevenDay, thirtyDay].
 * @customfunction
 */
function cloudGetCachedYieldHistory(ticker, start_date, end_date, includeHeader = true, forceRefresh = false) {
  const cacheKey = "cloudGetYieldHistory-v157-" + ticker + '-' + start_date + '-' + end_date + '-' + includeHeader;
  const cache = new Cacher({
    cachePoint: CacheService.getDocumentCache() || CacheService.getScriptCache()
  })

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      const cacheArray = JSON.parse(cacheVal);
      for (const i in cacheArray) {
        if (i == 0 && includeHeader) continue;
        if (cacheArray[i] != null && cacheArray[i][0])
          cacheArray[i][0] = new Date(cacheArray[i][0]);
      }
      return cacheArray;
    }
  }

  const resp = cloudGetYieldHistory_(ticker, start_date, end_date, includeHeader);

  // set ttl for 6AM as the tickers normally are not updated after 6AM. A user could force a refresh if necessary.
  const ttl = cacheCalcTTLAfterHour_(6);
  cacheLogTTL_(cacheKey, new Date, ttl);
  cache.set(cacheKey, JSON.stringify(resp), { expiry: ttl });
  return resp;
}

function cloudGetFullYieldHistory_(ticker, forceRefresh = false) {
  if (!ticker) {
    throw new Error('Fund ticker is required');
  }
  const dates = cloudGetCachedYieldHistoryRange(ticker, forceRefresh);
  const earliest_date = new Date("2020-01-01");
  const start_date = (dates[0][0].getTime() < earliest_date.getTime()) ? earliest_date : dates[0][0];
  Logger.log(ticker + ' mm.fun History start date = ' + start_date);
  return cloudGetYieldHistory_(ticker, start_date, dates[0][1], false);
}

// internal function that does the query and retrieval.
function cloudGetYieldHistory_(ticker, start_date, end_date, includeHeader = true) {

  const sDate = new Date(start_date);
  const eDate = new Date(end_date);
  //Logger.log('start=' + sDate + '  end =' + eDate);
  if (!Number.isFinite(sDate.getTime()) || !Number.isFinite(eDate.getTime()) || sDate > eDate) {
    throw new Error('Invalid yield history date range');
  }
  const json = cloudGetSortedYieldHistory_(ticker);

  let lastSaveDate = 0;
  let lastSaveOneDayRate = '';
  let lastSaveSevenDayRate = 0;
  let lastSaveThirtyDayRate = '';
  let result = [];
  for (let r in json) {
    const jsonDate = duGetDateFromYYYYMMDD_(json[r].asOfDate);
    const jsonOneDayRate = json[r].oneDayYield != null && json[r].oneDayYield !== '' ? json[r].oneDayYield * 1 : '';
    const jsonSevenDayRate = json[r].sevenDayYield != null && json[r].sevenDayYield !== '' ? json[r].sevenDayYield * 1 : '';
    const jsonThirtyDayRate = json[r].thirtyDayYield != null && json[r].thirtyDayYield !== '' ? json[r].thirtyDayYield * 1 : '';

    if (jsonDate.getTime() >= sDate.getTime() && jsonDate.getTime() <= eDate.getTime()) {
      // fill in gap dates from last recorded date missing in source dataset.
      if (lastSaveDate) {
        // find next date after last one added.
        let gapDate = new Date(lastSaveDate.getFullYear(), lastSaveDate.getMonth(), lastSaveDate.getDate() + 1);
        while (gapDate < jsonDate) {
          result.push([gapDate, lastSaveOneDayRate, lastSaveSevenDayRate, lastSaveThirtyDayRate]);
          gapDate = new Date(gapDate.getFullYear(), gapDate.getMonth(), gapDate.getDate() + 1);
        }
      }
      // append the latest row from the source data set and get ready for next loop.
      lastSaveDate = jsonDate;
      lastSaveOneDayRate = jsonOneDayRate;
      lastSaveSevenDayRate = jsonSevenDayRate;
      lastSaveThirtyDayRate = jsonThirtyDayRate;
      result.push([lastSaveDate, lastSaveOneDayRate, lastSaveSevenDayRate, lastSaveThirtyDayRate]);
    }
  }
  if (!result.length) throw new Error('No yield history for ' + ticker + ' in the requested date range');
  // stick the header in if data was found and caller wants header.
  if (result.length && includeHeader) {
    result.unshift(['As Of Date', '1-day Yield', '7-day Yield', '30-day Yield']);
  }
  return result;
}

function cloudGetSortedYieldHistory_(ticker) {
  if (typeof ticker !== 'string' || !ticker.trim()) throw new Error('Fund ticker is required');
  const rows = cloudGetYieldHistoryJson_(ticker);
  if (!Array.isArray(rows) || !rows.length) throw new Error('No yield history for ' + ticker);
  for (const row of rows) {
    const date = row && duGetDateFromYYYYMMDD_(row.asOfDate);
    if (!date || !Number.isFinite(date.getTime())) throw new Error('Invalid yield history date for ' + ticker);
  }
  return rows.slice().sort((a, b) => duGetDateFromYYYYMMDD_(a.asOfDate) - duGetDateFromYYYYMMDD_(b.asOfDate));
}
