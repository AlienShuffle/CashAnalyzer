// Fidelity.gs
// v86 - added FMPXX, FNSXX
// v87 - added FISXX, FRBXX

/**
 * Map Ticker to the Fund ID. This is manually maintained unless I come up with
 * a scheme to dynamically retrieve from fidelity.com.
 */
function getFidelityFundIDs_() {
  return {
    'FABXX': '6958', // Fidelity California Municipal Money Market Fund ($1)
    'FAUXX': '6957', // Fidelity Massachusetts Municipal Money Market Fund ($1)
    'FAWXX': '6959', // Fidelity New York Municipal Money Market Fund ($1)
    'FAYXX': '6960', // Fidelity New Jersey Municipal Money Market Fund ($1)
    'FCEXX': '600',  // Fidelity Investments Money Market Treasury Portfolio - Class II ($1M)
    'FCGXX': '657',  // Fidelity Investments Money Market Government Portfolio - Class III ($1M)
    'FCIXX': '541',  // Fidelity Investments Money Market - Money Market Portfolio - Class II ($1M)
    'FCOXX': '659',  // Fidelity Investments Money Market - Money Market Portfolio - Class III ($1M)
    'FCSXX': '696',  // Fidelity Investments Money Market Treasury Portfolio - Class III ($1M)
    'FCVXX': '604',  // Fidelity Investments Money Market Government Portfolio - Class II ($1M)
    'FDEXX': '84',   // Fidelity Tax-Exempt Money Market Fund - Daily Money Class ($1)
    'FDLXX': '415',  // Fidelity Treasury Only Money Market Fund ($1)
    'FDRXX': '55',   // Fidelity Government Cash Reserves ($1)
    'FDUXX': '58',   // Fidelity Treasury Money Market Fund - Daily Money Class ($1)
    'FERXX': '79',   // Fidelity Tax-Exempt Money Market Fund - Capital Reserves Class ($1)
    'FETXX': '684',  // Fidelity Investments Money Market Tax Exempt Portfolio - Class III ($1M)
    'FEXXX': '544',  // Fidelity Investments Money Market Tax Exempt Portfolio - Class II ($1M)
    'FGEXX': '918',  // Fidelity Investments Money Market Government Portfolio - Select Class ($1M)
    'FIGXX': '57',   // Fidelity Investments Money Market Government Portfolio - Class I ($1M)
    'FISXX': '695',  // Fidelity Investments Money Market Treasury Portfolio - Class I ($1M)
    'FMAXX': '1871', // Fidelity Massachusetts Municipal Money Market Fund - Institutional Class ($1M)
    'FMOXX': '275',  // Fidelity Tax-Exempt Money Market Fund ($1)
    'FMPXX': '59',   // Fidelity Investments Money Market - Money Market Portfolio - Class I ($1M)
    'FMSXX': '426',  // Fidelity Massachusetts Municipal Money Market Fund - Premium Class ($25K)
    'FMYXX': '931',  // Fidelity Investments Money Market - Money Market Portfolio - Select Class ($1M)
    'FNKXX': '1869', // Fidelity New York Municipal Money Market Fund - Institutional Class ($1M)
    'FNSXX': '2013', // Fidelity Investments Money Market - Money Market Portfolio - Institutional Class ($10M)
    'FOIXX': '543',  // Fidelity Investments Money Market - Treasury Only Portfolio - Class III ($?)
    'FOPXX': '2017', // Fidelity Investments Money Market - Treasury Only Portfolio - Class IV ($?)
    'FOXXX': '542',  // Fidelity Investments Money Market - Treasury Only Portfolio - Class II ($?)
    'FRBXX': '2644', // Fidelity Investments Money Market Treasury Portfolio - Institutional Class ($10M)
    'FRGXX': '2642', // Fidelity Investments Money Market Government Portfolio - Institutional Class ($10M)
    'FRSXX': '2643', // Fidelity Investments Money Market Treasury Only Portfolio - Institutional Class ($10M)
    'FSBXX': '1868', // Fidelity California Municipal Money Market Fund - Institutional Class ($1M)
    'FSIXX': '680',  // Fidelity Investments Money Market Treasury Only Portfolio - Class I ($1M)
    'FSJXX': '423',  // Fidelity New Jersey Municipal Money Market Fund - Premium Class ($25K)
    'FSKXX': '1870', // Fidelity New Jersey Municipal Money Market Fund - Institutional Class ($1M)
    'FSNXX': '422',  // Fidelity New York Municipal Money Market Fund - Premium Class ($25K)
    'FSPXX': '457',  // Fidelity California Municipal Money Market Fund - Premium Class ($25K)
    'FSRXX': '77',   // Fidelity Treasury Money Market Fund - Capital Reserves Class ($1)
    'FSXXX': '938',  // Fidelity Investments Money Market Tax Exempt Portfolio - Select Class ($1M)
    'FTCXX': '56',   // Fidelity Investments Money Market Tax Exempt Portfolio - Class I ($1M)
    'FTEXX': '10',   // Fidelity Municipal Money Market Fund ($1)
    'FTUXX': '911',  // Fidelity Investments Money Market Treasury Portfolio - Select Class ($1M)
    'FTVXX': '2016', // Fidelity Investments Money Market Treasury Portfolio - Class IV ($1M)
    'FTYXX': '906',  // Fidelity Investments Money Market Treasury Only Portfolio - Select Class ($1M)
    'FYHXX': '8398', // Fidelity Treasury Digital Fund ($1M)
    'FZAXX': '2739', // Fidelity Government Money Market Fund - Capital Reserves Class ($1)
    'FZCXX': '2741', // Fidelity Government Money Market Fund - Premium Class ($100K)
    'FZDXX': '2738', // Fidelity Money Market Fund - Premium Class ($100K)
    'FZEXX': '2737', // Fidelity Tax-Exempt Money Market Fund - Premium Class ($25K)
    'FZFXX': '2742', // Fidelity Treasury Money Market Fund ($1)
    'FZGXX': '3018', // Fidelity Government Money Market Fund - Advisor Cl M ($1)
    'SPAXX': '458',  // Fidelity Government Money Market Fund ($1)
    'SPRXX': '454',  // Fidelity Money Market Fund ($1)
  };
}
/**
 * Given a ticker, look up its fund id and return it.
 */
function mapTickerToFundId_(ticker) {
  const fundId = getFidelityFundIDs_();
  if (fundId[ticker] == null)
    throw 'Invalid Ticker or not supported yet: ' + ticker;
  return (fundId[ticker]);
}
//function howManyFidelityFunds() { const f = Object.keys(getFidelityFundIDs_()); Logger.log("# of Fidelity MM = " + f.length); }
//function testMap() {Logger.log(mapTickerToFundId_('SPAXX'));}

/**
 * Builds a metadata table for supported Fidelity money-market funds, sorted by ticker.
 * Header: Ticker, Fund #, CUSIP, Share Class, Short Name, Legal Name, Portfolio Name, Fiscal Year End.
 * Script/menu use recommended: a cold user cache requires one fetch per fund and may exceed
 * the worksheet execution limit. Example (script): buildFidelityFundListTable()
 * @return {Array<Array<string|number>>} Eight-column table including a header.
 */
function buildFidelityFundListTable() {
  const fundIds = getFidelityFundIDs_();
  let list = [];
  list.push([
    "Ticker",
    "Fund #",
    "CUSIP",
    "Share Class",
    "Short Name",
    "Legal Name",
    "Portfolio Name",
    "Fiscal Year End",

  ]);

  for (const ticker of Object.keys(fundIds).sort()) {
    const fundId = fundIds[ticker];
    const fundFacts = retrieveFidelityFundFacts_(fundId, false);
    list.push([
      fundFacts.tradingSymbol,
      fundFacts.fundNo,
      fundFacts.cusipNumber,
      fundFacts.shareClass,
      fundFacts.shortName,
      fundFacts.legalName,
      fundFacts.portfolioLegalName,
      fundFacts.fiscalYearEndMonthName,

    ]);
  }
  return list;
}

/**
 * Returns supported Fidelity money-market tickers from the locally maintained ID map.
 * Example: =fidelityGetFundTickerList()
 * @return {Array<string>} Ticker list in map insertion order, without a header.
 * @customfunction
 */
function fidelityGetFundTickerList() {
  const fundId = getFidelityFundIDs_();
  const resp = [];
  for (const key of Object.keys(fundId)) {
    resp.push(key);
  }
  return resp;
}

/**
 * Returns Fidelity Institutional's current money-market yields, using the user cache.
 * No header; annualized, non-compounding yields are decimals (0.04 = 4%).
 * Throws for an unsupported ticker or failed retrieval.
 * Example: =fidelityGetCachedYields("FZDXX")
 * @param {string} ticker Supported money-market ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number>>} One row: [[date, oneDay, sevenDay, thirtyDay]].
 * @customfunction
 */
function fidelityGetCachedYields(ticker, forceRefresh = false) {
  const cacheKey = "FidelityYields-" + ticker;
  const cache = CacheService.getUserCache();

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      if (cacheArray != null) {
        if (cacheArray[0][0]) cacheArray[0][0] = new Date(cacheArray[0][0]);
        return cacheArray;
      }
    }
  }

  const fundId = mapTickerToFundId_(ticker);
  const resp = fidelityGetYields_(fundId);

  // set ttl from asOf date.
  const tradetime = resp[0][0];
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns Fidelity Institutional's current one-day decimal yield, using the user cache.
 * No header. Throws for an unsupported ticker or failed retrieval.
 * Example: =fidelityGetCached1DayYield("FDLXX")
 * @param {string} ticker Supported money-market ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number>>} One row: [[date, oneDayYield]].
 * @customfunction
 */
function fidelityGetCached1DayYield(ticker, forceRefresh = false) {
  const cacheKey = "Fidelity1DayYield-v65-" + ticker;
  const cache = CacheService.getUserCache();

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      if (cacheArray != null) {
        if (cacheArray[0][0]) cacheArray[0][0] = new Date(cacheArray[0][0]);
        return cacheArray;
      }
    }
  }

  const fundId = mapTickerToFundId_(ticker);
  const resp = fidelityGet1DayYield_(fundId);

  // set ttl from asOf date.
  const tradetime = resp[0][0];
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns Fidelity Institutional's recent decimal yields in ascending date order.
 * Uses the user cache; no header or gap filling. Throws if no history is available.
 * Example: =fidelityGetCachedRecentYieldHistory("SPAXX")
 * @param {string} ticker Supported money-market ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number>>} Rows: [date, oneDay, sevenDay, thirtyDay].
 * @customfunction
 */
function fidelityGetCachedRecentYieldHistory(ticker, forceRefresh = false) {
  const cacheKey = "fidelityYieldHistory-v157-" + ticker;
  const cache = CacheService.getUserCache();

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (const i in cacheArray) {
        if (cacheArray[i] != null && cacheArray[i][0])
          cacheArray[i][0] = new Date(cacheArray[i][0]);
      }
      return cacheArray;
    }
  }

  const fundId = mapTickerToFundId_(ticker);
  Logger.log("fidelityGetRecentYieldHistory_() for " + ticker);
  const resp = fidelityGetRecentYieldHistory_(fundId);

  // set ttl from latest reported date.
  const tradetime = safeObjectRef_(resp[resp.length - 1][0]);
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns Fidelity Institutional's recent one-day decimal yields in ascending date order.
 * Uses the user cache; no header or gap filling. Throws if no history is available.
 * Example: =fidelityGetCachedRecent1DayYieldHistory("FDRXX")
 * @param {string} ticker Supported money-market ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached result.
 * @return {Array<Array<Date|number>>} Rows: [date, oneDayYield].
 * @customfunction
 */
function fidelityGetCachedRecent1DayYieldHistory(ticker, forceRefresh = false) {
  const resp = fidelityGetCachedRecentYieldHistory(ticker, forceRefresh);
  let result = [];
  for (const i in resp) {
    let row = [];
    row[0] = resp[i][0];
    row[1] = resp[i][1];
    result.push(row);
  }
  return result;
}

// -- internal functions. --

// Retrieves the fund data source from Fidelity's Institutional site.
function fidelityRetrieveFundJSON_(fundId) {
  const url = Utilities.formatString("https://institutional.fidelity.com/app/fund/data/%1u.json", fundId);
  const response = UrlFetchApp.fetch(url);
  const contentText = response.getContentText();
  if (contentText.length < 1)
    throw 'No content found for' + url;
  return jsonExtractAndParse_(contentText);
}

/**
 * Fetches the 1, 7, and 30-day non-compounding yields (in that order) for 
 * a Fidelity money-market fund.
 * Returns [asOf, 1-day-yield, 7-day-yield, 30-day-yield]
 * 
 * @param {} fundId - the number of the Fidelity Fund, available at institutional.fidelity.com
 */
function fidelityGetYields_(fundId) {
  const data = fidelityRetrieveFundJSON_(fundId);
  const result = [];
  //result.push(safeObjectRef_(data.overview.tradingSymbol));
  result.push(new Date(data.prices[0].navDate));
  result.push(data.prices[0].milrateYields[0].oneDayYield / 100);
  result.push(data.prices[0].milrateYields[0].sevenDayYield / 100);
  result.push(data.prices[0].milrateYields[0].thirtyDayYield / 100);
  return [result];
}

/**
 * Fetches the 1-day non-compounding yield for a Fidelity money-market fund.
 * Returns  [asOf, 1-day-yield]
 * 
 * @param {'55'} fundId - the number of the Fidelity Fund, available at institutional.fidelity.com
 */
function fidelityGet1DayYield_(fundId) {
  const data = fidelityRetrieveFundJSON_(fundId);
  const result = [];
  //result.push(safeObjectRef_(data.overview.tradingSymbol));
  result.push(new Date(data.prices[0].navDate));
  result.push(data.prices[0].milrateYields[0].oneDayYield / 100);
  return [result];
}

/**
 * Fetches the 1, 7, and 30-day non-compounding yields (in that order) for 
 * a Fidelity money-market fund.
 * Returns  [[asOf, 1-day-yield, 7-day-yield, 30-day-yield]]
 * 
 * @param {number} fundId - the number of the Fidelity Fund, available at institutional.fidelity.com
 */
function fidelityGetRecentYieldHistory_(fundId) {
  Logger.log("fidelityGetRecentYieldHistory_(" + fundId + ")");
  const data = fidelityRetrieveFundJSON_(fundId);
  const results = [];
  for (const i in data.historicalPricingYield[0].prices) {
    const row = [];
    row.push(new Date(data.historicalPricingYield[0].prices[i].date));
    row.push(data.historicalPricingYield[0].prices[i].milRateAndYields[0].oneDayYield / 100);
    row.push(data.historicalPricingYield[0].prices[i].milRateAndYields[0].sevenDayYield / 100);
    row.push(data.historicalPricingYield[0].prices[i].milRateAndYields[0].thirtyDayYield / 100);
    results.push(row);
  }
  if (!results.length) throw new Error('No recent Fidelity yield history for fund ' + fundId);
  return results.sort((a, b) => a[0] - b[0]);
}

// Use the current fund data endpoint for both facts and history.
function retrieveFidelityYieldHistoryJSON_(fundId = '55') {
  return fidelityRetrieveFundJSON_(fundId);
}

/**
 * Fetches misc. fund level facts about a Fidelity money-market fund.
 * 
 * @param {'3018'} fundId - the number of the Fidelity Fund, available at institutional.fidelity.com
 * @returns  [fund facts]
 */
function retrieveFidelityFundFacts_(fundId, forceRefresh = false) {

  const cacheKey = "fidelityFundFacts-v126-" + fundId;
  const cache = CacheService.getUserCache();

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      return cacheArray;
    }
  }

  const data = retrieveFidelityYieldHistoryJSON_(fundId);
  const ticker = data.overview.tradingSymbol;

  const resp = {
    "marketingName": data.overview.marketingName,
    "fundNo": data.overview.fundNo,
    "legalName": data.overview.legalName,
    "shortName": data.overview.shortName,
    "cusipNumber": data.overview.cusipNumber,
    "tradingSymbol": data.overview.tradingSymbol,
    "shareClass": data.overview.shareClass,
    "portfolioLegalName": data.overview.portfolioLegalName,
    "fiscalYearEndMonthName": data.overview.fiscalYearEndMonthName,
  };
  cache.put(cacheKey, JSON.stringify(resp), cacheBoundTTL_(2 * 24 * 60 * 60));
  return resp;
}

/**
 * Fetches the 1, 7, and 30-day non-compounding yields (in that order) for 
 * a Fidelity money-market fund.
 * Returns [[asOf, 1-day-yield, 7-day-yield, 30-day-yield]]
 * 
 * @param {"458"} fundId - the number of the Fidelity Fund, available at institutional.fidelity.com
 */
function retrieveFidelityYieldHistory_(fundId) {
  const data = retrieveFidelityYieldHistoryJSON_(fundId);
  const results = [];
  for (const i in data.historicalPricingYield[0].prices) {
    const row = [];
    row.push(new Date(data.historicalPricingYield[0].prices[i].date));
    row.push(data.historicalPricingYield[0].prices[i].milRateAndYields[0].oneDayYield / 100);
    row.push(data.historicalPricingYield[0].prices[i].milRateAndYields[0].sevenDayYield / 100);
    row.push(data.historicalPricingYield[0].prices[i].milRateAndYields[0].thirtyDayYield / 100);
    results.push(row);
  }
  return results;
}
// https://institutional.fidelity.com/app/funds/historicalFundPricing?fundNo=55&startDate=01/02/2023&endDate=02/28/2023
// https://institutional.fidelity.com/app/fund/data/55.json?filter=returns&returnsDate=04/30/2023
