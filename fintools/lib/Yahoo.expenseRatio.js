// yahoo.getExpenseRatio.gs
// v152 - refactoring.

/**
 * Returns Yahoo's fund expense ratio as a decimal (0.0003 = 0.03%), using the user cache.
 * Missing/not-applicable expense ratios return "n/a"; malformed values throw.
 * Example: =yahooGetCachedExpenseRatio("VTI")
 * @param {string} ticker Fund ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {number|string} Scalar decimal ratio or "n/a", not an array.
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
  const ttl = cacheBoundTTL_(30 * 24 * 60 * 60);
  cacheLogTTL_(cacheKey, "", ttl);
  cache.put(cacheKey, resp, ttl);
  return resp;
}

/**
 * Fetches a scalar decimal expense ratio from Yahoo, or "n/a" if unavailable.
 * @param {string} ticker Fund ticker.
 * @return {number|string} Decimal ratio or "n/a".
 */
function yahooGetExpenseRatio_(ticker) {
  // Fetch HTML from URL.
  // tag to search for: >Expense Ratio
  // https://finance.yahoo.com/quote/VTSAX?p=VTSAX&.tsrc=fin-srch

  const url = "https://finance.yahoo.com/quote/" + ticker + "?p=" + ticker + "&.tsrc=fin-srch";
  //const url = "https://finance.yahoo.com/quote/" + ticker;

  const resp = UrlFetchApp.fetch(url).getContentText();
  const stringER = Yahoo_extractExpenseRatio_(resp);
  if (stringER == "" || stringER.toUpperCase() == "N/A")
    return "n/a";
  const ratio = Number(stringER) / 100;
  if (!Number.isFinite(ratio)) throw new Error('Invalid Yahoo expense ratio for ' + ticker + ': ' + stringER);
  return ratio;
}

function Yahoo_extractExpenseRatio_(inputMarkup) {
  if (inputMarkup.indexOf(">Expense Ratio") < 0) return "";
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(">Expense Ratio"));
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf("<span "));
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(">"));
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(">"));
  inputMarkup = inputMarkup.substring(1, inputMarkup.indexOf("</span>"));
  inputMarkup = inputMarkup.replace(/">/, "");
  inputMarkup = inputMarkup.replace(/%/, "");
  return inputMarkup;
}