// vg.advisors.getYield.gs

/**
 * Returns Vanguard Advisors website's current SEC Yield (ETFs) or NAV (mutual funds).
 * Uses the document cache when available, otherwise the script cache.
 * Throws for missing/invalid quote data. Example: =vanguardGetCachedYield("VTI", TRUE)
 * @param {string} ticker Vanguard's fund/ETF ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, yield]]
 * @customfunction
 */
function vanguardGetCachedYield(ticker, forceRefresh = false) {
  const cacheKey = `vanguardGetCachedYield-av162-${ticker}`;
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
  const resp = vanguardAdvisorsYieldById_(fundId);
  if (typeof resp === 'undefined' || resp.length === 0) throw new Error(`yield lookup failure ticker:${ticker}`);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns Vanguard Advisors website's current SEC Yield (ETFs) or NAV (mutual funds).
 * Uses the document cache when available, otherwise the script cache.
 * Throws for missing/invalid quote data. Example: =vanguardGetCachedYieldId("0585", TRUE)
 * @param {string} fundId Vanguard's fund/ETF fundId, not the ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, yield]]
 * @customfunction
 */
function vanguardGetCachedYieldId(fundId, forceRefresh = false) {
  const cacheKey = `vanguardGetCachedYieldId-av162-${fundId}`;
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

  const resp = vanguardAdvisorsYieldById_(fundId);
  if (typeof resp === 'undefined' || resp.length === 0) throw new Error(`yield lookup failure id:${fundId}`);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

// internal retrieval function to find a Ticker's price by fund id.
function vanguardAdvisorsYieldById_(fundId = "0011") {

  const url = `https://advisors.vanguard.com/investments/products/api/funds/${fundId}/analytics/yields`;

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
  if (!json || !json.secYield || !json.secYield.effectiveDate || json.secYield.percent == null) {
    throw new Error('No SEC yield found for fund ID: ' + fundId);
  }
  return [[duGetDateFromYYYYMMDD_(json.secYield.effectiveDate), parseFloat(json.secYield.percent) / 100]];
}