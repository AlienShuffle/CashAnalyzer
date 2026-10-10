// multpl.gs - fintools library entry points
// v22 - baselined functional from deployment v22 and later.
// v152 - verified

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
  return fintools.multplGetCachedCAPE(forceRefresh);
}