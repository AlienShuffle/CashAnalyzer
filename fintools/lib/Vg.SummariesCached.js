// vg.SummariesCached.gs
// Cached public APIs backed by api.vanguard.com.

/**
 * Returns Vanguard's fund identifier from api.vanguard.com summaries, using the script cache.
 * Identifier formatting is source-defined, not guaranteed to be four digits.
 * Example: =vanguardGetCachedFundId("VUSXX")
 * @param {string} ticker Vanguard ticker.
 * @param {boolean} [forceRefresh=false] Refresh the underlying summaries.
 * @return {string|number} Fund identifier. Throws for an unknown ticker.
 * @customfunction
 */
function vanguardGetCachedFundId(ticker, forceRefresh = false) {

  const resp = vanguardGetCachedFundSummaries(forceRefresh);
  for (let i = 1; i < resp.length; i++) {
    if (resp[i][0] == ticker) {
      return resp[i][3];
    }
  }
  throw "invalid ticker: " + ticker;
}

/**
 * Returns a field from api.vanguard.com fund summaries, using the script cache.
 * Yield and expense ratio are decimals (0.04 = 4%); missing fields are empty strings.
 * Names are shortened: removes " Fund"/"Vanguard ", changes Money Market to MM,
 * Admiral Shares to Adm, and Investor Shares to Inv.
 * Example: =vanguardGetCachedFundParameter("VTSAX", 8)
 * @param {string} ticker Vanguard ticker.
 * @param {number} parameter Integer column index:
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
 * @param {boolean} [forceRefresh=false] Refresh the underlying summaries.
 * @return {string|number|Date} Field value. Throws for an unknown ticker or invalid index.
 * @customfunction
 */
function vanguardGetCachedFundParameter(ticker, parameter, forceRefresh = false) {
  if (!Number.isInteger(parameter) || parameter < 0 || parameter > 11) {
    throw new Error('Vanguard parameter must be an integer from 0 to 11');
  }

  const resp = vanguardGetCachedFundSummaries(forceRefresh);

  for (let i = 1; i < resp.length; i++) {
    if (resp[i][0] == ticker) {
      if (parameter == 4)
        return resp[i][parameter]
          .replace(" Fund", "")
          .replace("Money Market", "MM")
          .replace("Vanguard ", "")
          .replace("Admiral Shares", "Adm")
          .replace("Investor Shares", "Inv");
      else
        return resp[i][parameter];
    }
    throw new Error('Invalid Vanguard ticker: ' + ticker);
  }
}

/**
 * Returns api.vanguard.com mutual-fund and ETF summaries, using the script cache.
 * Header: Ticker, Price, SEC yield, ID, Name, Category high, Asset class, Category low,
 * Expense Ratio, Share class, Price as of date, Yield as of date.
 * Yields/expense ratios are decimals; missing values are empty strings.
 * Rows preserve source order (mutual funds then ETFs). Example: =vanguardGetCachedFundSummaries()
 * @param {boolean} [forceRefresh=false] Bypass the cached table.
 * @return {Array<Array<string|number|Date>>} Twelve-column table with a header.
 * @customfunction
 */
function vanguardGetCachedFundSummaries(forceRefresh = false) {

  const cacheKey = "vanguardSummary-v157";
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (let i = 1; i < cacheArray.length; i++) {
        if (cacheArray[i][10] != null && cacheArray[i][10] != "") {
          cacheArray[i][10] = new Date(cacheArray[i][10]);
        }
        if (cacheArray[i][11] != null && cacheArray[i][11] != "") {
          cacheArray[i][11] = new Date(cacheArray[i][11]);
        }
      }
      return cacheArray;
    }
  }

  const resp = vanguardGetPriceYieldAndAttributes_(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
  if (resp.length < 2) throw new Error('No Vanguard fund summaries');
  // log ttl calculations using date in first fund entry (second row).
  const tradeTime = resp[1][10];
  const ttl = cacheCalcTTL_(tradeTime);
  cacheLogTTL_(cacheKey, tradeTime, ttl);

  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns api.vanguard.com bond fund/ETF attributes, using the script cache.
 * Header: Ticker, Name, Duration, Average maturity, Yield to maturity, Average coupon,
 * As of date, Asset class, Expense Ratio. Duration/maturity are years; rates are decimals.
 * Missing fields are empty strings; rows preserve source order (mutual funds then ETFs).
 * Example: =vanguardGetCachedBondAttributes()
 * @param {boolean} [forceRefresh=false] Bypass the cached table.
 * @return {Array<Array<string|number|Date>>} Nine-column table with a header.
 * @customfunction
 */
function vanguardGetCachedBondAttributes(forceRefresh = false) {

  const cacheKey = "vanguardBondAttributes-v157";
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (let i = 1; i < cacheArray.length; i++) {
        //Logger.log(cacheArray[i][0]);
        if (cacheArray[i][6] != null && cacheArray[i][6] != "" && cacheArray[i][6].length >= 10) {
          //Logger.log(cacheArray[i][6]);
          cacheArray[i][6] = new Date(cacheArray[i][6]);
          //Logger.log(cacheArray[i][6]);
        }
      }
      return cacheArray;
    }
  }

  const resp = vanguardGetBondAttributes_();
  // log ttl calculations.
  const ttl = cacheBoundTTL_(24 * 60 * 60);
  cacheLogTTL_(cacheKey, "", ttl);
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns Vanguard bond-fund/ETF duration in years, using cached bond attributes.
 * Example: =vanguardGetCachedBondDuration("BND")
 * @param {string} ticker Vanguard bond ticker.
 * @param {boolean} [forceRefresh=false] Refresh the underlying table.
 * @return {number|string} Duration in years or "" if unavailable. Throws for an unknown ticker.
 * @customfunction
 */
function vanguardGetCachedBondDuration(ticker, forceRefresh = false) {
  const resp = vanguardGetCachedBondAttributes(forceRefresh);
  for (let i = 1; i < resp.length; i++) {
    if (resp[i][0] == ticker) {
      //Logger.log(resp[i][0] + '=' + resp[i][2]);
      return resp[i][2];
    }
    throw new Error('Invalid Vanguard bond ticker: ' + ticker);
  }
}