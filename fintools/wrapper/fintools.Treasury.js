// fintools.Treasury.gs - fintools library entry points.
// v148 - re-baseline documentation.
// v152 - verified

/**
 * Retrieves a Treasury CMT Par Yield Curve over a period defined in the first parameter, pull from cache if available.
 * Retrieves Treasury yields from treasury.gov based upon a year or date input.
 * Note, this takes a month as input, but it appears that the Treasury site no longer supports months, only full years.
 * returns [[large_array sort by date]]
 * 
 * @param {"201906"} yearOrMonth [optional] YYYY for year, YYYYMM for month, or "all". Defaults to current year (months are currently broken).
 * @param {"real"} type [optional, default = "nominal"] "real" for real yields, missing or any other value for nominal yields. 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
function treasuryGetCachedGovYields(yearOrMonth, type = "nominal", forceRefresh = false) {
  return fintools.treasuryGetCachedGovYields(yearOrMonth, type, forceRefresh);
}

/**
 * Pull from cache if available and finds the TIPS CMT Par Yield Curve for the current month.
 * returns [[large_array sort by date]]
 * 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
function treasuryGetCachedRecentRealYields(forceRefresh = false) {
  return fintools.treasuryGetCachedRecentRealYields(forceRefresh);
}

/**
 * Pull from cache if available and finds the nominal CMT Par Yield Curve for the current month.
 * returns [[large_array sort by date]]
 * 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
function treasuryGetCachedRecentNominalYields(forceRefresh = false) {
  return fintools.treasuryGetCachedRecentNominalYields(forceRefresh);
}

/**
 * Pull from cache if available and finds the T-bill coupon rates for the current month.
 * returns [[large_array sort by date]]
 * 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
function treasuryGetCachedRecentTBillCoupons(forceRefresh = true) {
  return fintools.treasuryGetCachedRecentTBillCoupons(forceRefresh);
}

/**
 * Pull from cache if available and finds the current quotes Treasury Bill Investment Yield rates for the current month.
 * returns [[large_array sort by date]]
 * 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
function treasuryGetCachedRecentTBillYields(forceRefresh = false) {
  return fintools.treasuryGetCachedRecentTBillYields(forceRefresh);
}

/**
 * Retrieves a Treasury Bill Coupon Rate quotes over a period defined in the first parameter, pull from cache if available.
 * Retrieves Treasury rates from treasury.gov based upon a year or date input.
 * Note, this takes a month as input, but it appears that the Treasury site no longer supports months, only full years (except current month).
 * returns [[large_array sort by date]]
 * 
 * @param {"201906"} yearOrMonth [optional] YYYY for year, YYYYMM for month, or "all". Defaults to current year.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.* 
 * @customfunction
 */
function treasuryGetCachedTBillCoupons(yearOrMonth, forceRefresh = false) {
  return fintools.treasuryGetCachedTBillCoupons(yearOrMonth, forceRefresh);
}

/**
 * Retrieves a Treasury Bill quotes over a period defined in the first parameter, pull from cache if available.
 * Retrieves Treasury rates from treasury.gov based upon a year or date input.
 * Note, this takes a month as input, but it appears that the Treasury site no longer supports months, only full years (except current month).
 * returns [[large_array sort by date]]
 * 
 * @param {"201906"} yearOrMonth [optional] YYYY for year, YYYYMM for month, or "all". Defaults to current year (months are currently broken).
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.*
 * @customfunction
 */
function treasuryGetCachedTBillYields(yearOrMonth, forceRefresh = false) {
  return fintools.treasuryGetCachedTBillYields(yearOrMonth, forceRefresh);
}