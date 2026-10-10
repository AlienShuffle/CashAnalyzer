// fintools.TSP.gs - fintools library entry points.
// v152 - verified.

/**
 * Get asOfDateTime, and price from TSPtalk.com or cache for a fund letter.
 * returns [asOfDate, price]
 *
 * @param {"F"} fundLetter Fund ticker symbol.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new quote.
 * @customfunction
 */
function TSPGetCachedPrice(fundLetter, forceRefresh = false) {
  return fintools.TSPGetCachedPrice(fundLetter, forceRefresh);
}