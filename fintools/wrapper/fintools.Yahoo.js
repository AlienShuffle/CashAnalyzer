// fintools.Yahoo.gs - fintools library entry points.
// v152 - rebaselined/verified

/**
 * Returns market price for common stocks and ETFs, and NAV for mutual funds.
 * Returns asOfDateTime, Price, and optionally the Change % from finance.yahoo.com stock market ticker
 * It will use cached values if available.
 * Caching improves user experience and spreadsheet performance, but does not update the quotes as often,
 * causing mild delays in data in some cases.
 * returns [asOf, price] or [asOf, price, change %]
 * 
 * @param {"VTSAX"} ticker Fund ticker symbol.
 * @param {true} includeChangePct [optional, default = false]. true includes change % column to return array.
 * @param {false} forceRefresh [optional, default = false]. true forces a new quote, ignores the cache.
 * @customfunction
 */
function yahooGetCachedPrice(ticker, includeChangePct = false, forceRefresh = false) {
  return fintools.yahooGetCachedPrice(ticker, includeChangePct, forceRefresh);
}

/**
 * Get expense ratio from yahoo or cache for a fund ticker.
 * It will use cached values if available.
 * Caching improves user experience and spreadsheet performance, but does not update the quotes as often.
 * returns [expenseRatio]
 * 
 * @param {"VTI"} ticker Fund ticker symbol.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new quote, not use any available cache.
 * @customfunction
 */
function yahooGetCachedExpenseRatio(ticker, forceRefresh = false) {
  return fintools.yahooGetCachedExpenseRatio(ticker, forceRefresh);
}
