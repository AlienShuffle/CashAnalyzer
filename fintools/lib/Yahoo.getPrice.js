// yahoo.getPrice.gs
// v152 baseline.

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
  const cacheKey = `yahoo-v152-${ticker}`;
  const cache = CacheService.getDocumentCache();

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
   * Returns market price for common stocks and ETFs, and NAV for mutual funds.
   * Returns asOfDateTime, Price, and optionally the Change % from finance.yahoo.com stock market ticker feed.
   * returns [asOf, price] or [asOf, price, change %]
   * 
   * @param {"VMFXX"} ticker Fund ticker symbol.
   * @param {false} [includeChangePct] optional, default = false. true includes change % column to return array.
   * @return {date, number, number=} array [asOf, price] or [asOf, price, change %].
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
    const price = data.chart.result[0].meta.regularMarketPrice;

    if (isNaN(price)) {
      throw 'Element ' + element + ' found in price position is not a number.';
    } else {
      // Blank NAV will get converted to 0.
      if (price == 0) throw 'No price found for ticker ' + ticker + '.';
    }

    // Get price as of date/time reported by yahoo in epoch seconds.
    const asOf = data.chart.result[0].meta.regularMarketTime + data.chart.result[0].meta.gmtoffset;
    const dateTime = duDateTimeFromSecs_(asOf);

    if (!includeChangePct) {
      return [[dateTime, price]];
    } else {
      // get change percentage
      const previousClose = data.chart.result[0].meta.chartPreviousClose;
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
