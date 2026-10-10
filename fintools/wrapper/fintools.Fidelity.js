// fintools.Fidelity.gs - fintools library entry points.
// v27 - baselined functional from deployment v26 and later.
// v80 - added an entry point for the list of Fidelity Tickers supported.
// v126 - added: buildFidelityFundListTable
// v152 - verified.

/**
 * Returns current 1-day, 7-day and 30-day yields for a Fidelity MM Fund.
 * It will use cached values if available.
 * returns [asOf, 1-day-yield, 7-day-yield, 30-day-yield]
 * 
 * @param {"FZDXX"} ticker Fund ticker symbol (only MM funds are supported).
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new quote, not use any available cache.
 * @customfunction
 */
function fidelityGetCachedYields(ticker, forceRefresh = false) {
  return fintools.fidelityGetCachedYields(ticker, forceRefresh);
}

/**
 * Returns current 1-day yield for a Fidelity MM Fund.
 * It will use cached values if available.
 * returns [asOf, 1-day-yield]
 * 
 * @param {"FDLXX"} ticker Fund ticker symbol (only MM funds are supported).
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new quote, not use any available cache.
 * @customfunction
 */
function fidelityGetCached1DayYield(ticker, forceRefresh = false) {
  return fintools.fidelityGetCached1DayYield(ticker, forceRefresh);
}

/**
 * Returns current a list of recent 1-day, 7-day and 30-day yields for a Fidelity MM Fund.
 * It will use cached values if available.
 * returns [[date, 1-day-yield, 7-day-yield, 30-day-yield]]
 * 
 * @param {"SPAXX"} ticker Fund ticker symbol (only MM funds are supported).
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new quote, not use any available cache.
 * @customfunction
 */
function fidelityGetCachedRecentYieldHistory(ticker, forceRefresh = false) {
  return fintools.fidelityGetCachedRecentYieldHistory(ticker, forceRefresh);
}

/**
 * Returns current a list of recent 1-day yields for a Fidelity MM Fund.
 * It will use cached values if available.
 * returns [[date, 1-day-yield]]
 * 
 * @param {"FDRXX"} ticker Fund ticker symbol (only MM funds are supported).
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new quote, not use any available cache.
 * @customfunction
 */
function fidelityGetCachedRecent1DayYieldHistory(ticker, forceRefresh = false) {
  return fintools.fidelityGetCachedRecent1DayYieldHistory(ticker, forceRefresh);
}

/**
 * Returns current a list of support Fidelity MM Fund tickers.
 * returns [ticker]
 * 
 * @returns [ticker]
 * @customfunction
 */
function fidelityGetFundTickerList() {
  return fintools.fidelityGetFundTickerList();
}

/**
 * Returns current a list of support Fidelity MM Fund tickers with a full range of fund identifiers.
 * returns [[ticker facts]]
 * 
 * @customfunction
 */
function buildFidelityFundListTable() {
  return fintools.buildFidelityFundListTable();
}