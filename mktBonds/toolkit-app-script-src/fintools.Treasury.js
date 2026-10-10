// fintools.Treasury.gs - fintools library entry points.
// v12 - baselined functional from deployment v12 and later.

/**
 * Retrieves Treasury CMT yields over a period defined in the first parameter, pull from cache if available.
 * Retrieves Treasury yields from treasury.gov based upon a year or date input.
 * Note, this takes a month as input, but it appears that the Treasury site no longer supports months, only full years.
 * @param {201906} yearOrMonth [optional] YYYY for year, YYYYMM for month, or "all". Defaults to current year (months are currently broken).
 * @param {"real"} type [optional, default = "nominal"] "real" for real yields, missing or any other value for nominal yields. 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @returns [[large_array]]
 * @customfunction
 */
function treasuryGetCachedGovYields(yearOrMonth, type = "nominal", forceRefresh = false) {
  return fintools.treasuryGetCachedGovYields(yearOrMonth, type, forceRefresh);
}

/**
 * Pull from cache if available and finds the TIPS CMT rates for the current month.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @returns [[large_array]]
 * @customfunction
 */
function treasuryGetCachedRecentRealYields(forceRefresh = false) {
  return fintools.treasuryGetCachedRecentRealYields(forceRefresh);
}

/**
 * Pull from cache if available and finds the nominal CMT rates for the current month.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @returns [[large_array]]
 * @customfunction
 */
function treasuryGetCachedRecentNominalYields(forceRefresh = false) {
  return fintools.treasuryGetCachedRecentNominalYields(forceRefresh);
}