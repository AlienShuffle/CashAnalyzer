// fintools.Banks.gs - fintools library entry points for Bank Rates Functions.
// v98 - added CashPlus, and Ally now officially works.
// v99 - updated to create a single generic entry point for both rates and rate history.
// v103 - added additional entry points.
// v104 - added bankGetCachedAllRates()
// v114 - removed bankGetCachedAllRates()
// v152 - verified

/**
 * Function to returns latest Ally Savings Rate looking in the cache first. This pulled
 * from readngtndude's Google Drive folder where a json file is updated daily using a
 * scheduled script run off a locally managed computer.
 * returns [[asOfDate, rate]]
 * 
 * @param {string} bank Institution {"Ally", "Vanguard"}.
 * @param {string} account Ally account type {"Savings", "Checking"}.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @returns {[[date,float]]}
 * @customfunction
 */
function bankGetCachedRate(bank, account, forceRefresh = false) {
  return fintools.bankGetCachedRate(bank, account, forceRefresh);
}

/**
 * Function to returns latest Bank Savings Rate for accounts in the bank looking in the cache first. This pulled
 * from readngtndude's Google Drive folder where a json file is updated daily using a
 * scheduled script run off a locally managed computer.
 * returns [[asOfDate, rate]]
 * 
 * @param {string} bank Institution {"Ally"=, "Vanguard"}.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @returns {[[date,float]]}
 * @customfunction
 */
function bankGetCachedAllRates(bank, forceRefresh = false) {
  return fintools.bankGetCachedAllRates(bank, forceRefresh);
}

/**
 * This retrieves a list of account Types currently recorded in the rates file.
 * @param {string} bank Institution {"Ally"=, "Vanguard"}.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [accountTypes] list of entries.
 * @customfunction
 */
function bankGetCachedAccounTypes(bank, forceRefresh = false) {
  return fintools.bankGetCachedAccounTypes(bank, forceRefresh);
}

/**
 * Returns the Bank Account's APY yield history for the Bank and account type.
 * 
 * @param {string} bank Institution {"Ally", "Vanguard"}.
 * @param {string} account Ally account type {"Savings", "Checking"}.
 * @param {date} start_date First date for which to retrieve price and yield.
 * @param {date} end_date Last date for which to retrieve price and yield.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[asOfDate, APY]].
 * @customfunction
 */
function bankGetCachedRateHistory(bank, account, start_date, end_date, forceRefresh = false) {
  return fintools.bankGetCachedRateHistory(bank, account, start_date, end_date, forceRefresh);
}

/**
 * Retrieve date range for the bank rate (APY) history for a bank acount. 
 * [date, date]
 * as an array returned from the fintools bank database.
 *
 * @param {string} bank Institution {"Ally"=, "Vanguard"}.
 * @param {string} account account type, varies {"Savings"=, "Checking"}
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [oldestDate, newestDate]
 * @customfunction
 */
function bankGetCachedRateHistoryDates(bank, account, forceRefresh = false) {
  return fintools.bankGetCachedRateHistoryDates(bank, account, forceRefresh);
}

/** ====== these are not normally used by end-user scripts ====== */

/**
 * This retrieves the unprocessed contents of a bank's rate file.
 * This is here primarily to allow a file to be retrieved without knowledge of where or how the file is stored.
 * JSON structure is well defined though.
 *
 * @param {string} bank Institution {"Ally", "Vanguard"}.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return JSON list of entries.
 * @customfunction
 */
function bankGetCurrentRateFileContents(bank, forceRefresh = false) {
  return fintools.bankGetCurrentRateFileContents(bank, forceRefresh);
}

/**
 * retrieve a list of available bank sources in the bank database.
 *
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return [[ticker, oldest-yield-date, newest-yield-date]
 * @customfunction
 */
function bankCachedAvailableBanks(forceRefresh = false) {
  return fintools.bankCachedAvailableBanks(forceRefresh);
}

/**
 * This retrieves the unprocessed contents of a bank's rate history file.
 * This is here primarily to allow a file to be retrieved without knowledge of where or how the file is stored.
 * JSON structure is well defined though.
 *
 * @param {string} bank Institution {"Ally", "Vanguard"}.
 * @param {boolean=} forceRefresh [optional, default = false]. true forces a new query, ignores the cache.
 * @return JSON list of entries.
 * @customfunction
 */
function bankGetCurrentRateHistoryFileContents(bank, forceRefresh = false) {
  return fintools.bankGetCurrentRateHistoryFileContents(bank, forceRefresh);
}
