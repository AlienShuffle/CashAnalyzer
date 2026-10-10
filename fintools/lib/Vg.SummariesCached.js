// vg.SummariesCached.gs
// v150 - split to just have the Summaries related APIs (these still use the older personal.vanguard.com APIs).

/**
 * Returns the four digit fundId for a vanguard fund ticker as a string. Returns fundId.
 * 
 * @param {"VUSXX"} ticker Vanguard fund ticker.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. True forces a new query, and do not use any available cache.
 * @customfunction
 */
// #S1
function vanguardGetCachedFundId(ticker, forceRefresh = false) {

  const resp = vanguardGetCachedFundSummaries(forceRefresh);
  for (let i = 0; i < resp.length; i++) {
    if (resp[i][0] == ticker) {
      return resp[i][3];
    }
  }
  throw "invalid ticker: " + ticker;
}

/**
 * Get get the requested parameter for a vanguard fund sticker stored in the Cache from the Fund Summaries Report.
 * Returns parameter requested.
 * 
 * @param {"VTSAX"} ticker Vanguard fund ticker.
 * @param {8} parameter parameter index from this list:
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
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. True forces a new query, and do not use any available cache.
 * @customfunction
 */
// #S2
function vanguardGetCachedFundParameter(ticker, parameter, forceRefresh = false) {

  const resp = vanguardGetCachedFundSummaries(forceRefresh);

  for (let i = 0; i < resp.length; i++) {
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
  }
}

/**
 * Returns a table of all Vanguard funds with a large set of details about each fund including latest NAV,
 * SEC Yield, Duration and other details. Will pull from cache if available. Returns large table with a header row.
 * 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
// #S3
function vanguardGetCachedFundSummaries(forceRefresh = false) {

  const cacheKey = "vanguardSummary";
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
  // log ttl calculations using date in first fund entry (second row).
  const tradeTime = resp[1][10];
  const ttl = cacheCalcTTL_(tradeTime);
  cacheLogTTL_(cacheKey, tradeTime, ttl);

  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Retrieves bond attributes from Vanguard mutual funds AND ETF summary pages bond attributes view.
 * Will pull from cache if available. returns a large table with a header row.
 * 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
// #S4
function vanguardGetCachedBondAttributes(forceRefresh = false) {

  const cacheKey = "vanguardBondAttributes";
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
  const ttl = 24 * 60 * 60;
  cacheLogTTL_(cacheKey, "", ttl);
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Retreived Bond Duration attribute, returns a float value.
 * 
 * @param {"VTSAX""} ticker Vanguard Bond fund/ETF ticker.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
// #S5
function vanguardGetCachedBondDuration(ticker, forceRefresh = false) {
  const resp = vanguardGetCachedBondAttributes(forceRefresh);
  for (let i = 0; i < resp.length; i++) {
    if (resp[i][0] == ticker) {
      //Logger.log(resp[i][0] + '=' + resp[i][2]);
      return resp[i][2];
    }
  }
}