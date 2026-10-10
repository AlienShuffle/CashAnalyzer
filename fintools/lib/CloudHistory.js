// cloudHistory.gs
// v135 - migrate from mmHistory to cloudFlare version.

/**
 * Retrieve the most recent yield values for an stored money market fund. This will use cached values if available.
 * Caching improves user experience and spreadsheet performance, but does not update the quotes as often,
 * causing mild delays in data in some cases. Not an issues with Price Yield History.
 * Returns a matrix with each row including
 * {[date, float, float, float]} [date, 1-day yield, 7-day Yield, 30-day Yield]
 * as an array returned from the fintools archive database.
 * Note, 1 day and 30 day yields may not be available, the columns will be empty.
 * They are currently only available for Fidelity funds.
 *
 * @param {string} ticker ticker of the fund.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[asOfDate, 1-day, 7-day, 30-day]].
 * @customfunction
 */
function cloudGetCachedYieldFromHistory(ticker, forceRefresh = false) {
  const eDate = new Date;
  const sDate = duGetDateDelta_(eDate, -5);
  const yields = cloudGetCachedYieldHistory(ticker, sDate, eDate, false, forceRefresh);
  if (yields) {
    const index = yields.length - 1;
    return [[yields[index][0], yields[index][1], yields[index][2], yields[index][3]]];
  } else {
    return;
    //throw ticker + "failed retrieval.";
  }
}

function cloudGetCachedOneDayYieldHistory(ticker, start_date, end_date, forceRefresh = false) {
  const yields = cloudGetCachedYieldHistory(ticker, start_date, end_date, false, forceRefresh);
  if (yields) {
    const resp = yields.map(function (value) { return [value[0], value[1]] });
    return resp;
  } else {
    throw ticker + "failed retrieval";
  }
}

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
 * Retrieve yield history date range available for an money market fund from moneymarket.fun. This will use cached values if available.
 * Caching improves user experience and spreadsheet performance, but does not update the quotes as often,
 * causing mild delays in data in some cases. Not an issues with Price Yield History.
 * Returns a the start and end dates
 * {[[date, date]]} [[startDate, endDate]]
 * as an array returned from the fintools archive database.
 *
 * @param {string} ticker ticker of the fund.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[startDate, endDate]]
 * @customfunction
 */
function cloudGetCachedYieldHistoryRange(ticker, forceRefresh = false) {
  const cacheKey = "cloudGetYieldHistoryRange-v136" + ticker;
  const cache = new Cacher({
    cachePoint: CacheService.getDocumentCache()
  })

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal != '' && (cacheVal.substring(0, 7) == 'failed:' || cacheVal.indexOf('check ticker') > -1)) {
      return 'check ticker symbol, not found';
    }
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      if (cacheArray[0] != null && cacheArray[0][0])
        cacheArray[0][0] = new Date(cacheArray[0][0]);
      if (cacheArray[0] != null && cacheArray[0][1])
        cacheArray[0][1] = new Date(cacheArray[0][1]);
      return cacheArray;
    }
  }

  try {
    const resp = cloudGetYieldHistoryRange_(ticker);

    // set ttl for 6AM as the tickers normally are not updated after 6AM. A user could force a refresh if necessary.
    const ttl = cacheCalcTTLAfterHour_(6);
    cacheLogTTL_(cacheKey, new Date, ttl);
    cache.set(cacheKey, JSON.stringify(resp), ttl);
    return resp;
  } catch (err) {
    cache.set(cacheKey, 'failed: ' + err.message, 120);
    return 'check ticker symbol, not found';
  }
}

// internal function that does the query and retrieval.
function cloudGetYieldHistoryRange_(ticker) {
  const json = cloudGetYieldHistoryJson_(ticker);
  return [[
    duGetDateFromYYYYMMDD_(json[0].asOfDate),
    duGetDateFromYYYYMMDD_(json[json.length - 1].asOfDate)
  ]];
}

/**
 * Retrieve yield history for an money market fund from moneymarket.fun. This will use cached values if available.
 * Caching improves user experience and spreadsheet performance, but does not update the quotes as often,
 * causing mild delays in data in some cases. Not an issues with Price Yield History.
 * Returns a matrix with each row including
 * {[date, float]} [date, 7-day Yield]
 * as an array returned from the fintools archive database.
 *
 * @param {string} ticker ticker of the fund.
 * @param {date} start_date First date for which to retrieve price and yield.
 * @param {date} end_date Last date for which to retrieve price and yield.
 * @param {boolean=} includeHeader [optional, default = true]. adds a header row to result.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[asOfDate, 1,day, 7-day, 30-day]].
 * @customfunction
 */
function cloudGetCachedYieldHistory(ticker, start_date, end_date, includeHeader = true, forceRefresh = false) {
  const cacheKey = "cloudGetYieldHistory-v147-" + ticker + '-' + start_date + '-' + end_date + '-' + includeHeader;
  const cache = new Cacher({
    cachePoint: CacheService.getDocumentCache()
  })

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      const cacheArray = JSON.parse(cacheVal);
      for (i in cacheArray) {
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
  cache.set(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

function cloudGetFullYieldHistory_(ticker, forceRefresh = false) {
  if (!ticker) {
    Logger.log('missing ticker symbol');
    return;
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
  const json = cloudGetYieldHistoryJson_(ticker);

  let lastSaveDate = 0;
  let lastSaveOneDayRate = '';
  let lastSaveSevenDayRate = 0;
  let lastSaveThirtyDayRate = '';
  let result = [];
  for (let r in json) {
    const jsonDate = duGetDateFromYYYYMMDD_(json[r].asOfDate);
    const jsonOneDayRate = safeObjectRef_(json[r].oneDayYield) ? json[r].oneDayYield * 1 : '';
    const jsonSevenDayRate = safeObjectRef_(json[r].sevenDayYield) ? json[r].sevenDayYield * 1 : '';
    const jsonThirtyDayRate = safeObjectRef_(json[r].thirtyDayYield) ? json[r].thirtyDayYield * 1 : '';

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
  // stick the header in if data was found and caller wants header.
  if (result.length && includeHeader) {
    result.unshift(['As Of Date', '1-day Yield', '7-day Yield', '30-day Yield']);
  }
  return result;
}
