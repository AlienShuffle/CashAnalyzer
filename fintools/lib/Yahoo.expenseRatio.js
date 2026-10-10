// yahoo.getExpenseRatio.gs
// v152 - refactoring.

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

  const cacheKey = `ExpenseRatioYahoo-v152-${ticker}`;
  const cache = CacheService.getUserCache();

  // retrieve a previously cached ER if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    if (cacheVal != null) {
      if (cacheVal == "" || cacheVal == "N/A" || cacheVal == "n/a")
        return "n/a";
      return parseFloat(cacheVal);
    }
  }

  const resp = yahooGetExpenseRatio_(ticker);
  // set ttl to 30 days, ER doesn't change often.
  const ttl = 30 * 24 * 60 * 60;
  cacheLogTTL_(cacheKey, "", ttl);
  cache.put(cacheKey, resp, ttl);
  return resp;
}

/**
 * Get expense ratio for fund ticker from yahoo.
 * Returns market price for ETFs, and NAV for mutual funds.
 * @param {"VTI"} ticker Fund ticker symbol.
 * @param {false} [includeChangePct] [OPTIONAL, default = FALSE]. 1 or true = return change % column; 0, false or missing = do not.
 * @returns [asOf, price] or [asOf, price, change %].
 * @customfunction
 */
function yahooGetExpenseRatio_(ticker) {
  // Fetch HTML from URL.
  // tag to search for: >Expense Ratio
  // https://finance.yahoo.com/quote/VTSAX?p=VTSAX&.tsrc=fin-srch

  const url = "https://finance.yahoo.com/quote/" + ticker + "?p=" + ticker + "&.tsrc=fin-srch";
  //const url = "https://finance.yahoo.com/quote/" + ticker;

  const resp = UrlFetchApp.fetch(url).getContentText();
  const stringER = Yahoo_extractExpenseRatio_(resp);
  if (stringER == "" || stringER == "N/A")
    return "n/a";
  return stringER / 100;
}

function Yahoo_extractExpenseRatio_(inputMarkup) {
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(">Expense Ratio"));
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf("<span "));
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(">"));
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(">"));
  inputMarkup = inputMarkup.substring(1, inputMarkup.indexOf("</span>"));
  inputMarkup = inputMarkup.replace(/">/, "");
  inputMarkup = inputMarkup.replace(/%/, "");
  return inputMarkup;
}