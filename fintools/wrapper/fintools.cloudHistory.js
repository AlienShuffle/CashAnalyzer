// fintools.cloudHistory.gs - v154 - verified.

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
// #C1 - v154 verified
function cloudGetCachedYieldFromHistory(ticker, forceRefresh = false) {
  return fintools.cloudGetCachedYieldFromHistory(ticker, forceRefresh);
}

/**
 * returns just the 1-day yields for the fund vs. all three values in cloudGetCachedYieldHistory()
 * never includes a header row.
 * 
 * @param {string} ticker ticker of the fund.
 * @param {date} start_date First date for which to retrieve price and yield.
 * @param {date} end_date Last date for which to retrieve price and yield.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[asOfDate, 1-day]].
 * @customfunction
 */
// #C2 - v154 verified
function cloudGetCachedOneDayYieldHistory(ticker, start_date, end_date, forceRefresh = false) {
  return fintools.cloudGetCachedOneDayYieldHistory(ticker, start_date, end_date, forceRefresh);
}

/**
 * returns just the 7-day yields for the fund vs. all three values in cloudGetCachedYieldHistory()
 * never includes a header row.
 * 
 * @param {string} ticker ticker of the fund.
 * @param {date} start_date First date for which to retrieve price and yield.
 * @param {date} end_date Last date for which to retrieve price and yield.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[asOfDate, 7-day]].
 * @customfunction
 */
// v152 - verified
function cloudGetCachedSevenDayYieldHistory(ticker, start_date, end_date, forceRefresh = false) {
  return fintools.cloudGetCachedSevenDayYieldHistory(ticker, start_date, end_date, forceRefresh);
}

/**
 * Retrieve yield history for an cloudd mutual fund. This will use cached values if available.
 * Caching improves user experience and spreadsheet performance, but does not update the quotes as often,
 * causing mild delays in data in some cases. Not an issues with Price Yield History.
 * Returns a matrix with each row including {[date, float, float, float]} [date,, 1-day yield, 7-day Yield, 30-day Yield] as strings returned from the fintools cloud database.
 * Note, 1 day and 30 day yields may not be available.
 *
 * @param {string} ticker ticker of the fund.
 * @param {date} start_date First date for which to retrieve price and yield.
 * @param {date} end_date Last date for which to retrieve price and yield.
 * @param {boolean=} includeHeader [optional, default = true]. adds a header row to result.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[asOfDate, 1,day, 7-day, 30-day]].
 * @customfunction
 */
// v152 - verified
function cloudGetCachedYieldHistory(ticker, start_date, end_date, includeHeader = true, forceRefresh = false) {
  return fintools.cloudGetCachedYieldHistory(ticker, start_date, end_date, includeHeader, forceRefresh);
}

/**
 * Retrieve yield history date range available for a money market fund from moneymarket.fun. This will use cached values if available.
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
// C#5 - v154 - verified
function cloudGetCachedYieldHistoryRange(ticker, forceRefresh = false) {
  return fintools.cloudGetCachedYieldHistoryRange(ticker, forceRefresh);
}