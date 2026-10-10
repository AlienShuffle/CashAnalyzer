// fintools.Vanguard.gs -  fintools library entry points.
// v150 - overhaul to use new Institutional based APIs and general cleanup.
// v152 - retired the stranded Institutional-based APIs, must use the CashOptimizer source now.

/**
 * Returns the four digit fundId for a vanguard fund ticker as a string. Returns fundId.
 * source: personal.vanguard.com
 *  
 * @param {"VUSXX"} ticker Vanguard fund ticker.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. True forces a new query, and do not use any available cache.
 * @customfunction
 */
// #S1 - v152 - verified
function vanguardGetCachedFundId(ticker, forceRefresh = false) {
  return fintools.vanguardGetCachedFundId(ticker, forceRefresh);
}

/**
 * Get get the requested parameter for a vanguard fund sticker stored in the Cache from the Fund Summaries Report.
 * source: personal.vanguard.com
 * Returns parameter requested.
 * 
 * @param {"VTSAX"} ticker Vanguard fund ticker.
 * @param {8} parameter parameter index from this list:
 *  0 = Ticker,
 *  1 = Price,
 *  2 = SEC yield, 
 *  3 = ID,
 *  4 = Name, 
 *  5 = Category high,
 *  6 = Asset class,
 *  7 = Category low,
 *  8 = Expense Ratio,
 *  9 = Share class,
 * 10 = Price as of date,
 * 11 = Yield as of date.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. True forces a new query, and do not use any available cache.
 * @customfunction
 */
// #S2 - v152 - verified
function vanguardGetCachedFundParameter(ticker, parameter, forceRefresh = false) {
  return fintools.vanguardGetCachedFundParameter(ticker, parameter, forceRefresh);
}

/**
 * Returns a table of all Vanguard funds with a large set of details about each fund including latest NAV,
 * SEC Yield, Duration and other details. Will pull from cache if available. Returns large table with a header row.
 * source: personal.vanguard.com
 * 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
// #S3 - v152 - verified
function vanguardGetCachedFundSummaries(forceRefresh = false) {
  return fintools.vanguardGetCachedFundSummaries(forceRefresh);
}

/**
 * Retrieves bond attributes from Vanguard mutual funds AND ETF summary pages bond attributes view.
 * Will pull from cache if available. returns a large table with a header row.
 * source: personal.vanguard.com
 *  
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
// #S4 - v152 - verified
function vanguardGetCachedBondAttributes(forceRefresh = false) {
  return fintools.vanguardGetCachedBondAttributes(forceRefresh);
}

/**
 * Retreived Bond Duration attribute, returns a float value.
 * 
 * @param {"VTSAX""} ticker Vanguard Bond fund/ETF ticker.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
// #S5 - v152 - verified
function vanguardGetCachedBondDuration(ticker, forceRefresh = false) {
  return fintools.vanguardGetCachedBondDuration(ticker, forceRefresh);
}