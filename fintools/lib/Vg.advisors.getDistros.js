// vg.advisors.getPrice.gs

// other URLs to investigate
// https://advisors.vanguard.com/investments/products/api/funds/${portId}/fees
//  const expenseRatio = fees.adjustedExpenseRatio?.value != null ? Number(fees.adjustedExpenseRatio.value) : null;

/**
 * Returns Vanguard Advisors website's current SEC Yield (ETFs) or NAV (mutual funds).
 * Uses the document cache when available, otherwise the script cache.
 * Throws for missing/invalid quote data. Example: =vanguardGetCachedDistros("VTI", TRUE)
 * @param {string} ticker Vanguard's fund/ETF ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, yield]]
 * @customfunction
 */
function vanguardGetCachedDistros(ticker, forceRefresh = false) {
  const cacheKey = `vanguardGetCachedDistros-av162-${ticker}`;
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
  if (typeof fundId === 'undefined' || fundId.length === 0) throw `id lookup failure ticker:${ticker}`;
  const resp = vanguardAdvisorsDistrosById_(fundId);
  if (typeof resp === 'undefined' || resp.length === 0) throw `yield lookup failure id:${ticker}`;

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
 * Throws for missing/invalid quote data. Example: =vanguardGetCachedDistrosId("0585", TRUE)
 * @param {string} fundId Vanguard's fund/ETF fundId, not the ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, price]]
 * @customfunction
 */
function vanguardGetCachedDistrosId(fundId, forceRefresh = false) {
  const cacheKey = `vanguardGetCachedDistrosId-av162-${fundId}`;
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

  const resp = vanguardAdvisorsDistrosById_(fundId);
  if (typeof resp === 'undefined' || resp.length === 0) throw `yield lookup failure id:${fundId}`;

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

// internal retrieval function to find a Ticker's price by fund id.
function vanguardAdvisorsDistrosById_(fundId = "0585") {

  const url = `https://advisors.vanguard.com/investments/products/api/funds/${fundId}/pricing/distributions?hasDistributionYield=false`;

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
  //const timestamp = new Date;
  const results = [];
  for (let i = 0; i < json.length; i++) {
    const amount = json[i].amount.toFixed(6) * 1;
    results.push([
      json[i].typeCode,
      amount,
      json[i].recordDate,
      json[i].payableDate,
      json[i].reinvestDate,
      json[i].reinvestPrice,
    ]);
  }
  if (results.length === 0) return;
  return results;
}