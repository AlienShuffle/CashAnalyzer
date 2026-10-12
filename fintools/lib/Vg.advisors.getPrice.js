// vg.advisors.getPrice.gs

/**
 * Returns Vanguard Advisors website's market price (stocks/ETFs) or NAV (mutual funds).
 * Uses the document cache when available, otherwise the script cache.
 * Throws for missing/invalid quote data. Example: =vanguardGetCachedPrice("VTI", TRUE)
 * @param {string} ticker Vanguard's fund/ETF ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, price]]
 * @customfunction
 */
function vanguardGetCachedPrice(ticker, forceRefresh = false) {
  const cacheKey = `vanguardGetCachedPrice-v161-${ticker}`;
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

  const fundId = vanguardAdvisorsLookupId_(ticker);
  if (typeof fundId === 'undefined' || fundId.length === 0) throw new Error(`id lookup failure ticker:${ticker}`);
  const resp = vanguardAdvisorsPriceById_(fundId);
  if (typeof resp === 'undefined' || resp.length === 0) throw new Error(`price lookup failure ticker:${ticker}`);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns Vanguard Advisors website's market price (stocks/ETFs) or NAV (mutual funds).
 * Uses the document cache when available, otherwise the script cache.
 * Throws for missing/invalid quote data. Example: =vanguardGetCachedPriceId("0585", TRUE)
 * @param {string} fundId Vanguard's fund/ETF fundId, not the ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, price]]
 * @customfunction
 */
function vanguardGetCachedPriceId(fundId, forceRefresh = false) {
  const cacheKey = `vanguardGetCachedPriceId-v161-${fundId}`;
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

  const resp = vanguardAdvisorsPriceById_(fundId);
  if (typeof resp === 'undefined' || resp.length === 0) throw new Error(`lookup failure id:${fundId}`);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

// internal retrieval function to find a Ticker's price by fund id.
function vanguardAdvisorsPriceById_(fundId) {

  const url = `https://advisors.vanguard.com/investments/products/api/funds/${fundId}/pricing/daily?priceTypeCode=NAV&inceptionDate=2000-11-13`;
  const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/118.0.5993.117 Safari/537.36";

  const options = {
    headers: {
      'Referer': 'https://advisors.vanguard.com',
      "User-Agent": USER_AGENT
    }
  };

  const responseRaw = UrlFetchApp.fetch(url, options);
  const responseText = responseRaw.getContentText();
  const json = JSON.parse(responseText);
  let resp = [];
  const timestamp = new Date;
  for (let i = 0; i < json.length; i++) {
    resp.push({
      asOfDate: json[i].effectiveDate,
      price: json[i].price * 1,
      source: 'vanguardAdvisors',
      fundId: fundId,
      timestamp: timestamp,
    });
  }
  if (resp.length === 0) return;
  const latestItem = resp.reduce((latest, current) => {
    return new Date(current.asOfDate) > new Date(latest.asOfDate) ? current : latest;
  });
  return [[duGetDateFromYYYYMMDD_(latestItem.asOfDate), latestItem.price]];
}

// internal retrieval function to get a fund Id for a ticker.
function vanguardAdvisorsLookupId_(ticker) {

  const url = `https://advisors.vanguard.com/investments/products/${ticker.toLowerCase()}`;

  const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/118.0.5993.117 Safari/537.36";

  const options = {
    headers: {
      'Referer': 'https://advisors.vanguard.com',
      "User-Agent": USER_AGENT
    }
  };

  const responseRaw = UrlFetchApp.fetch(url, options);
  const html = responseRaw.getContentText();
  // find a json string that has high level fund data.
  const match = html.match(/__INITIAL_FUND_DATA__\s*=\s*(\{.*?\})\s*;?\s*<\/script>/s);
  if (!match) throw new Error(`Could not find __INITIAL_FUND_DATA__ for ${ticker}`);

  const fundData = JSON.parse(match[1]);
  if (!fundData.portId) throw new Error(`No portId in fund data for ${ticker}`);
  return fundData.portId;
}