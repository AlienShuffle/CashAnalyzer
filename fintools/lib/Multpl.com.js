// multpl.gs
// v22 - from fintools v22 and later.
// v50 baseline.
// v68 - updated table processing as the site HTML changed a bit for the table.

/**
 * Returns multpl.com's S&P500 CAPE most recently reported value. Found at https://www.multpl.com/shiller-pe/table/by-month
 * 
 * Caching improves user experience and spreadsheet performance, but does not update the quotes as often,
 * causing mild delays in data in some cases.
 * This particular query only changes once a day or less, so cache does not impose any significant delay.
 * Besides, this value is pretty slow moving. returns [asOf, CAPE]
 * 
 * @param {false} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @customfunction
 */
function multplGetCachedCAPE(forceRefresh = false) {
  const cacheKey = "multpl.com-CAPE-Recent-23";
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached CAPE value if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    if (cacheVal != null) {
      let cacheArray = JSON.parse(cacheVal);
      cacheArray[0][0] = new Date(cacheArray[0][0]);
      return cacheArray;
    }
  }

  const resp = multplGetCAPE_();
  const tradetime = resp[1];
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Get most recent S&P 500 CAPE10 value from multpl.com.
 * Returns [[reportDate, CAPE]]
 */
function multplGetCAPE_() {
  // Fetch HTML from URL.
  const url = "https://www.multpl.com/shiller-pe/table/by-month";

  var inputMarkup = UrlFetchApp.fetch(url).getContentText();

  // find first CAPE reference.
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf("<tr class="));
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf("<td>"));
  var capeDate = new Date(Date.parse(inputMarkup.substring(4, inputMarkup.indexOf("</td>"))));

  // find the next element for the value.
  inputMarkup = inputMarkup.substring(inputMarkup.indexOf(";"));
  var capeVal = parseFloat(inputMarkup.substring(1, inputMarkup.indexOf("</td>")));

  return [[capeDate, capeVal]];
}