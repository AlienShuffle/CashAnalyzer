// cnbc.getPrice.gs

/**
 * Returns CNBC's market price for stocks/ETFs, Do Not use for mutual funds.
 * Uses the document cache when available, otherwise the script cache.
 * Date preserves the source epoch instant; Sheets controls its displayed timezone.
 * Throws for missing/invalid quote data. Example: =cnbcGetCachedPrice("VTI", false)
 * @param {string} ticker Cnbc ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, price]]
 * @customfunction
 */
function cnbcGetCachedPrice(ticker, forceRefresh = false) {
  const cacheKey = `cnbc-v160-5D-${ticker}`;
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
      return cacheArray;
    }
  }

  const resp = cnbcPrice_(ticker);
  if (typeof resp === 'undefined' || resp.length === 0) throw new Error(`No CNBC quote for ${ticker}`);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns CNBC's market price NAV for mutual funds.
 * Only provides daily updates not intraday for ETF/stocks.
 * Uses the document cache when available, otherwise the script cache.
 * Date preserves the source epoch instant; Sheets controls its displayed timezone.
 * Throws for missing/invalid quote data. Example: =cnbcGetCachedPriceMutualFund("VTSAX", false)
 * @param {string} ticker Cnbc mutual fund ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, price]]
 * @customfunction
 */
function cnbcGetCachedPriceMutualFund(ticker, forceRefresh = false) {
  const cacheKey = `cnbcGetCachedPriceMutualFund-v160-5D-${ticker}`;
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
      return cacheArray;
    }
  }

  const resp = cnbcPrice_(ticker, "1M");
  if (typeof resp === 'undefined' || resp.length === 0) throw new Error(`No CNBC quote for ${ticker}`);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

// internal retrieval function
function cnbcPrice_(ticker, period = "5D") {

  // Function to convert a string like "20250430000000" to ISO date "YYYY-MM-DD"
  const convertToISODate = (dateStr) => `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  // new Date(year, monthIndex, day, hours, minutes, seconds)
  const convertToDateTime = (dateStr) => new Date(
    dateStr.slice(0, 4),
    dateStr.slice(4, 6) - 1,
    dateStr.slice(6, 8),
    dateStr.slice(8, 10),
    dateStr.slice(10, 12),
    dateStr.slice(12, 14)
  );

  // build a url for a given ticker and time range to fetch the yield history from cnbc.
  function buildUrl(symbol, timeRange) {
    const base = "https://webql-redesign.cnbcfm.com/graphql";
    const params = {
      operationName: "getQuoteChartData",
      variables: JSON.stringify({ symbol, timeRange }),
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: "9e1670c29a10707c417a1efd327d4b2b1d456b77f1426e7e84fb7d399416bb6b"
        }
      })
    };
    return base + "?" + Object.entries(params).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  }

  let resp = [];
  // 1Y = 1 year, 1M = 1 month, 5D = 5 days, 1D = 1 day
  // use 5D to get more recent (intra-day values even on non-trading days)
  // use 1Y to get a history for back testing for MM Optimizer.
  // This routine is intended for daily ticker updates.
  const url = buildUrl(ticker, period);
  const responseRaw = UrlFetchApp.fetch(url);
  const responseText = responseRaw.getContentText();
  const json = JSON.parse(responseText);

  const priceBars = json.data?.chartData?.priceBars;
  if (!priceBars || priceBars.length == 0) {
    Logger.log(`No price bars found for ticker ${ticker}`);
    return;
  }
  const dateList = priceBars.map(bar => bar.tradeTime);
  const closeList = priceBars.map(bar => bar.close);
  //const timestamp = new Date;

  for (let i = 0; i < dateList.length; i++) {
    const asOfDate = convertToISODate(dateList[i]);
    if (!closeList[i] || closeList[i] === 1.0) {
      Logger.log(`yields[i] is 1`);
      continue;
    }
    const close = closeList[i] * 1;
    if (!Number.isFinite(close)) {
      Logger.log(`Invalid close for ticker ${ticker} on ${asOfDate}: ${closeList[i]}`);
      continue;
    }
    if (close === 0 || close === 0.01) {
      Logger.log(`close is 0`);
      continue;
    }
    resp.push({
      //origDate: dateList[i],
      //asOfDate: asOfDate,
      date: convertToDateTime(dateList[i]),
      close: close,
      //source: 'cnbc',
      ticker: ticker,
      //timestamp: timestamp,
    });
  }

  if (resp.length === 0) return;
  const latestItem = resp.reduce((latest, current) => {
    return new Date(current.date) > new Date(latest.date) ? current : latest;
  });
  return [[latestItem.date, latestItem.close]];
}
