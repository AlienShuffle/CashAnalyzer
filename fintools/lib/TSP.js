// TSP.gs
// v12 - baselined functional from deployment v12 and later.
// v50 baseline.
// v140 - verified.

/**
 * Returns a TSP fund's share price from TSPtalk.com, using the script cache.
 * No header. Example: =TSPGetCachedPrice("F")
 * @param {string} fundLetter Required fund letter: G, F, C, S, or I.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number>>} One row: [[asOfDate, price]]. Throws for invalid data.
 * @customfunction
 */
function TSPGetCachedPrice(fundLetter, forceRefresh = false) {
  if (typeof fundLetter !== 'string' || !/^[GFCSI]$/i.test(fundLetter)) {
    throw new Error('TSP fund letter must be G, F, C, S, or I');
  }
  fundLetter = fundLetter.toUpperCase();
  const cacheKey = 'TSP-' + fundLetter;
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      // convert JSON string date back to a javascript date. Man, dates are annoying.
      if (cacheArray[0][0])
        cacheArray[0][0] = new Date(cacheArray[0][0]);
      return [[cacheArray[0][0], cacheArray[0][1]]];
    }
  }

  // Don't have a cached quote, so go out and get one.
  const resp = tspGetPrice_(fundLetter);

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);
  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return [[resp[0][0], resp[0][1]]];
}

/**
 * Get asOfDateTime and price from TSP.gov for TSP fund letter. Minimal testing has been completed. Corner cases my fail. 
 * returns [asOf, price].
 * @param {'F'} [fundLetter] Fund ticker symbol.
 */
function tspGetPrice_(fundLetter = 'F') {

  const  url = "https://www.tsptalk.com/tracker/tsp_funds_balance_returns_by_date.php";

  const  resp = UrlFetchApp.fetch(url);
  const  respText = resp.getContentText();
  //Logger.log("responseCode = %s", resp.getResponseCode());
  const  dateAsOf = TSP_extractAsOf_(respText);
  const  price = TSP_extractPrice_(fundLetter, respText);
  if (!Number.isFinite(dateAsOf.getTime()) || !Number.isFinite(price)) {
    throw new Error('Invalid TSP quote for ' + fundLetter);
  }
  return [[dateAsOf, price]];
}

function TSP_extractAsOf_(inputMarkup) {
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf("Fund Returns From:</font></b></TD>"));
  const  leftAnchor = "<font color=CC3300>";
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(leftAnchor));
  inputMarkup = inputMarkup.substring(leftAnchor.length, inputMarkup.indexOf("</font> thru <font"));
  //Logger.log(inputMarkup);
  const  parsedAsOf = Date.parse(inputMarkup);
  const  dateAsOf = new Date(parsedAsOf);
  return dateAsOf;
}

function TSP_extractPrice_(fundLetter, inputMarkup) {
  const  fundAnchor = fundLetter + "-fund";
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(fundAnchor));
  const  leftAnchor = "face=arial>";
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(leftAnchor));
  inputMarkup = inputMarkup.substring(leftAnchor.length, inputMarkup.indexOf("</font>"));
  return parseFloat(inputMarkup);
}