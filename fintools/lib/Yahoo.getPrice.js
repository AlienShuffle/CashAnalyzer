// yahoo.getPrice.gs
// v152 baseline.

/**
 * Returns Yahoo's market price (stocks/ETFs) or NAV (mutual funds), without a header.
 * Uses the document cache when available, otherwise the script cache.
 * Date preserves the source epoch instant; Sheets controls its displayed timezone.
 * Change is a decimal (0.01 = 1%), or "" if previous close is unavailable.
 * Throws for missing/invalid quote data. Example: =yahooGetCachedPrice("VTI", TRUE)
 * @param {string} ticker Yahoo ticker.
 * @param {boolean} [includeChangePct=false] Include the third column.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, price]] or [[asOf, price, change]].
 * @customfunction
 */
function yahooGetCachedPrice(ticker, includeChangePct = false, forceRefresh = false) {
  const cacheKey = `yahoo-v157-${ticker}`;
  const cache = CacheService.getDocumentCache() || CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      // convert JSON string date back to a javascript date. Man, dates are annoying.
      if (cacheArray[0][0])
        cacheArray[0][0] = new Date(cacheArray[0][0]);
      if (includeChangePct) {
        return cacheArray;
      } else {
        return [[cacheArray[0][0], cacheArray[0][1]]];
      }
    }
  }

  // Don't have a cached quote, so go out and get one.

  /**
   * Fetches a Yahoo quote with its original epoch timestamp.
   * @param {string} ticker Yahoo ticker.
   * @param {boolean} [includeChangePct=false] Include decimal change from previous close.
   * @return {Array<Array<Date|number|string>>} One quote row, without a header.
   */
  function yahooGetPrice_(ticker, includeChangePct = false) {

    // https://query1.finance.yahoo.com/v8/finance/chart/VTI?region=US&lang=en-US&includePrePost=false&interval=2m&useYfid=true&range=1d&corsDomain=finance.yahoo.com&.tsrc=finance         // Copy/paste into browser to view HTML.

    if (!ticker)
      throw 'Function getPriceYahoo parameter 1 expects a valid ticker, but no ticker was provided.';

    // Fetch HTML from URL.
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
      ticker + "?region=US&lang=en-US&includePrePost=false&interval=2m&useYfid=true&range=1d&corsDomain=finance.yahoo.com&.tsrc=finance";   // Base URL

    const response = UrlFetchApp.fetch(url);
    const contentText = response.getContentText();

    if (contentText.length < 1) throw 'No content found for ticker ' + ticker;

    // parse price.
    const data = JSON.parse(contentText);
    if (!data.chart || !data.chart.result || !data.chart.result.length) {
      throw new Error('No Yahoo quote for ' + ticker);
    }
    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;

    if (!Number.isFinite(price)) {
      throw new Error('Invalid Yahoo price for ' + ticker + ': ' + price);
    } else {
      // Blank NAV will get converted to 0.
      if (price == 0) throw 'No price found for ticker ' + ticker + '.';
    }

    // Get price as of date/time reported by yahoo in epoch seconds.
    const asOf = meta.regularMarketTime;
    if (!Number.isFinite(asOf)) throw new Error('Invalid Yahoo quote timestamp for ' + ticker);
    const dateTime = duDateTimeFromSecs_(asOf);

    if (!includeChangePct) {
      return [[dateTime, price]];
    } else {
      // get change percentage
      const previousClose = meta.chartPreviousClose;
      const changeCalc = previousClose ? (price / previousClose - 1) : "";
      return [[dateTime, price, changeCalc]];
    }
  }

  const resp = yahooGetPrice_(ticker, true);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);

  if (includeChangePct) {
    return resp;
  } else {
    return [[resp[0][0], resp[0][1]]];
  }
}
