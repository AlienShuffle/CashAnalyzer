// ty.RecentTBillsYields.gs
// v53 baseline added new file.
// v54 added entrypoint: treasuryGetCachedTBillYields()
// v55 changed return values for Tbills from Investment Yield to Closing Price (Bank Discount Yield)
// v56 added coupon and yield entry points so user can decide which to use.
// v148 - fixed date formatting error (appears to be new) and re-baseline.

/**
 * Returns treasury.gov current-month T-bill bank-discount rates, using the script cache.
 * "Coupons" is a legacy name: bills do not pay coupons. Rates are decimals (0.04 = 4%).
 * Header: Date, 4w, 8w, 13w, 17w, 26w, 52w. Rows preserve source order.
 * Example: =treasuryGetCachedRecentTBillCoupons()
 * @param {boolean} [forceRefresh=false] Bypass the cached table.
 * @return {Array<Array<Date|number|string>>} Seven-column table including a header.
 * @customfunction
 */
function treasuryGetCachedRecentTBillCoupons(forceRefresh = false) {

  const cacheKey = "treasuryGetCachedRecentTBillCoupons-v56";
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (let i = 1; i < cacheArray.length; i++)
        cacheArray[i][0] = new Date(cacheArray[i][0]);
      return cacheArray;
    }
  }

  const resp = treasuryGetRecentTBillRates_('coupon');

  // log TTL calculations.
  const tradetime = new Date(Date.parse(resp[resp.length - 1][0]));
  const ttl = treasuryCalcCacheTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns treasury.gov current-month T-bill investment yields, using the script cache.
 * Rates are decimals. Header: Date, 4w, 8w, 13w, 17w, 26w, 52w.
 * Rows preserve source order. Example: =treasuryGetCachedRecentTBillYields()
 * @param {boolean} [forceRefresh=false] Bypass the cached table.
 * @return {Array<Array<Date|number|string>>} Seven-column table including a header.
 * @customfunction
 */
function treasuryGetCachedRecentTBillYields(forceRefresh = false) {

  const cacheKey = "treasuryGetCachedRecentTBillYields-v55";
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (let i = 1; i < cacheArray.length; i++)
        cacheArray[i][0] = new Date(cacheArray[i][0]);
      return cacheArray;
    }
  }

  const resp = treasuryGetRecentTBillRates_('yield');

  // log TTL calculations.
  const tradetime = new Date(Date.parse(resp[resp.length - 1][0]));
  const ttl = treasuryCalcCacheTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Retrieve the Month to date daily Nominal Treasury Yields.
 * @returns [[large_array]]
 */
function treasuryGetRecentTBillRates_(type = 'yield') {
  const url = 'https://home.treasury.gov/sites/default/files/interest-rates/daily_treas_bill_rates.xml';

  let rawXml = UrlFetchApp.fetch(url).getContentText();

  const tags = (type == 'yield') ?
    ["ROUND_B1_YIELD_4WK_2",
      "ROUND_B1_YIELD_8WK_2",
      "ROUND_B1_YIELD_13WK_2",
      "ROUND_B1_YIELD_17WK_2",
      "ROUND_B1_YIELD_26WK_2",
      "ROUND_B1_YIELD_52WK_2"]
    :
    ["ROUND_B1_CLOSE_4WK_2",
      "ROUND_B1_CLOSE_8WK_2",
      "ROUND_B1_CLOSE_13WK_2",
      "ROUND_B1_CLOSE_17WK_2",
      "ROUND_B1_CLOSE_26WK_2",
      "ROUND_B1_CLOSE_52WK_2"];

  let dataTable = [];
  const headerRow = ["Date", "4w", "8w", "13w", "17w", "26w", "52w"];
  dataTable.push(headerRow);

  for (let i = 0; i < 31; i++) {
    let dataRow = [];

    // start with finding the next date.
    let tag = "INDEX_DATE";

    // no more days left in data.
    if (rawXml.indexOf("<" + tag + ">") < 0)
      break;

    // grab the current date and move past it.
    rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
    dataRow[0] = new Date(Date.parse(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">"))));
    //var openTagIndex = nominalRawXML.indexOf("</" + tag + ">");
    //var closeTagIndex = "</".concat(tag, ">").length;
    rawXml = rawXml.substring(rawXml.indexOf("</" + tag + ">") + "</".concat(tag, ">").length);

    const mktClosedTag = "<BOND_MKT_UNAVAIL_REASON>FEDERAL HOLIDAY</BOND_MKT_UNAVAIL_REASON>";
    // skip days when the market is closed and no rates are reported.
    // we know this because the market closed tag will be seen before the next date.
    const mktIndex = rawXml.indexOf(mktClosedTag);
    const tagIndex = rawXml.indexOf("<" + tag + ">");
    if (mktIndex > 0 && mktIndex < tagIndex) {
      rawXml = rawXml.substring(rawXml.indexOf(mktClosedTag) + mktClosedTag.length);
      continue;
    }

    for (let j = 0; j < tags.length; j++) {
      const tag = tags[j];
      rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
      dataRow[j + 1] = parseFloat(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">"))) / 100;
      rawXml = rawXml.substring(rawXml.indexOf("</" + tag + ">") + "</" + tag + ">".length);
    }

    // jump to the next section headed by <G_NEW_DATE>
    tag = "<G_INDEX_DATE>";
    rawXml = rawXml.substring(rawXml.indexOf(tag) + tag.length);

    dataTable.push(dataRow);
    Logger.log("TABLE LENGTH = %s", dataTable.length)
  }
  return dataTable;
}

/**
 * Returns treasury.gov T-bill bank-discount rates in ascending date order.
 * "Coupons" is a legacy name; rates are decimals, not coupon payments. Uses the script cache.
 * Header: Date, 4wk, 8wk, 13wk, 17wk, 26wk, 52wk.
 * Example: =treasuryGetCachedTBillCoupons(2026)
 * @param {string|number} [yearOrMonth] YYYY, YYYYMM, or "all"; omitted/blank uses current year.
 * @param {boolean} [forceRefresh=false] Bypass the cached table.
 * @return {Array<Array<Date|number|string>>} Seven-column table with a header; missing maturities blank.
 * @customfunction
 */
function treasuryGetCachedTBillCoupons(yearOrMonth, forceRefresh = false) {
  yearOrMonth = yearOrMonth || new Date().getFullYear();

  const cacheKey = "treasuryGetCachedTBillCoupons-v56" + "-" + yearOrMonth;
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (let i = 0; i < cacheArray.length; i++)
        if (cacheArray[i][0] != 'Date')
          cacheArray[i][0] = new Date(cacheArray[i][0]);
      return cacheArray;
    }
  }

  const resp = treasuryGetCachedTBillRates_(yearOrMonth, 'coupon');

  // log TTL calculations.
  const tradetime = new Date(Date.parse(resp[resp.length - 1][0]));
  const ttl = treasuryCalcCacheTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns treasury.gov T-bill investment yields in ascending date order, using the script cache.
 * Rates are decimals. Header: Date, 4wk, 8wk, 13wk, 17wk, 26wk, 52wk.
 * YYYYMM requests the month-specific endpoint (unlike CMT's full-year fallback).
 * Example: =treasuryGetCachedTBillYields(202610)
 * @param {string|number} [yearOrMonth] YYYY, YYYYMM, or "all"; omitted/blank uses current year.
 * @param {boolean} [forceRefresh=false] Bypass the cached table.
 * @return {Array<Array<Date|number|string>>} Seven-column table with a header; missing maturities blank.
 * @customfunction
 */
function treasuryGetCachedTBillYields(yearOrMonth, forceRefresh = false) {
  yearOrMonth = yearOrMonth || new Date().getFullYear();

  const cacheKey = "treasuryGetCachedTBillYields-v148" + "-" + yearOrMonth;
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (let i = 0; i < cacheArray.length; i++)
        if (cacheArray[i][0] != 'Date')
          cacheArray[i][0] = new Date(cacheArray[i][0]);
      return cacheArray;
    }
  }

  const resp = treasuryGetCachedTBillRates_(yearOrMonth, 'yield');

  // log TTL calculations.
  const tradetime = new Date(Date.parse(resp[resp.length - 1][0]));
  const ttl = treasuryCalcCacheTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Retrieves Treasury yields from treasury.gov based upon a year or date input.
 *
 * @param {201906} yearOrMonth [optional] YYYY for year, YYYYMM for month, or "all". Defaults to current year.
 * @param {"yield"} type [optional] default = "yield" for investment yields, any other value for coupon yields
 */
function treasuryGetCachedTBillRates_(yearOrMonth, type = 'yield') {
  // https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_bill_rates&field_tdr_date_value=2023

  let url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_bill_rates';

  const columns = (type.toLocaleLowerCase() == 'yield') ?
    ["INDEX_DATE",
      "ROUND_B1_YIELD_4WK_2",
      "ROUND_B1_YIELD_8WK_2",
      "ROUND_B1_YIELD_13WK_2",
      "ROUND_B1_YIELD_17WK_2",
      "ROUND_B1_YIELD_26WK_2",
      "ROUND_B1_YIELD_52WK_2"]
    :
    ["INDEX_DATE",
      "ROUND_B1_CLOSE_4WK_2",
      "ROUND_B1_CLOSE_8WK_2",
      "ROUND_B1_CLOSE_13WK_2",
      "ROUND_B1_CLOSE_17WK_2",
      "ROUND_B1_CLOSE_26WK_2",
      "ROUND_B1_CLOSE_52WK_2"];
  const headers = ["Date", "4wk", "8wk", "13wk", "17wk", "26wk", "52wk"];

  // Determine year and/or month, and build URL string, with some argument checks.  
  if (!yearOrMonth) {                                   // If no argument 1, default to current month.
    const d = new Date();
    const year = d.getFullYear().toString();
    var month = d.getMonth() + 1;                       // Change 0-11 to 1-12.
    month = month.toString();                           // URL works with single digit or 2-digit month.

    //url += '&field_tdr_date_value=' + year + month;
    // just put in the year since months seems to be broken at treasury.gov
    url += '&field_tdr_date_value=' + year;

  } else {                                               // Determine year and/or month from argument 1.
    yearOrMonth = yearOrMonth.toString();
    if (yearOrMonth.length == 4) {                       // Year only: YYYY.
      const year = yearOrMonth;
      url += '&field_tdr_date_value=' + year;
    } else if (yearOrMonth.length == 6) {                // Year and month: YYYYMM.
      const year = yearOrMonth.substring(0, 4);
      const month = yearOrMonth.substring(4, 6);
      url += '&field_tdr_date_value_month=' + year + month;
      // or just put in the year since months seems to be broken at treasury.gov
      //url += '&field_tdr_date_value=' + year;
    } else if (yearOrMonth.toLowerCase() == 'all') {     // All.
      // URL without parameters works for all.
      url += '&field_tdr_date_value=all';
    } else {
      throw 'Invalid argument 1. Function treasuryGovYields expects argument 1 format of YYYY, YYYYMM or "all".';
    }
  }
  Logger.log(url);

  // Get response text and parse xml.
  const responseText = UrlFetchApp.fetch(url).getContentText();
  // Logger.log(responseText);
  const xml = responseText;
  const document = XmlService.parse(xml);

  // Navigate XML to get the data elements.
  const root = document.getRootElement();
  const namespace = root.getNamespace();                                       // Need namespace to get elements by name.
  const children = document.getRootElement().getChildren('entry', namespace);  // 'entry' is name of the top element of each data elements set.
  //Logger.log(children.length);

  // Insert header row defined earlier.
  let results = [];

  for (let i = 0; i < children.length; i++) {
    const content = children[i].getChild('content', namespace);  // 'content' is name of the grandparent element of each set of data elements.
    // Logger.log(content.getChildren()[0].getName());           // Just curiouse. It is 'properties'.
    const data = content.getChildren()[0].getChildren();         // First child of content is parent of data elements.
    let row = [];
    for (let j = 0; j < data.length; j++) {
      const name = data[j].getName();
      const value = data[j].getValue();

      switch (name) {
        // If the Name is 'NEW_DATE', it always goes in column 0;
        // Otherwise, place the values in the correct column as per the model to publish them.
        // Note, I did it this way to support the transition to adding 17 Week treasuries into display, old dates, will be missing
        // those entries.
        case 'INDEX_DATE':
          row[0] = duGetDateFromYYYYMMDD_(value.substring(0, 10));
          break;

        // Nominal values
        case 'ROUND_B1_CLOSE_4WK_2':
        case 'ROUND_B1_CLOSE_8WK_2':
        case 'ROUND_B1_CLOSE_13WK_2':
        case 'ROUND_B1_CLOSE_17WK_2':
        case 'ROUND_B1_CLOSE_26WK_2':
        case 'ROUND_B1_CLOSE_52WK_2':
        case 'ROUND_B1_YIELD_4WK_2':
        case 'ROUND_B1_YIELD_8WK_2':
        case 'ROUND_B1_YIELD_13WK_2':
        case 'ROUND_B1_YIELD_17WK_2':
        case 'ROUND_B1_YIELD_26WK_2':
        case 'ROUND_B1_YIELD_52WK_2':
          const index = columns.indexOf(name);
          if (index < 0) break;
          row[index] = value / 100;
          break;

        // unused element.
        default:
          break;
      }
    }
    results.push(Array.from({ length: headers.length }, (_, index) => row[index] === undefined ? '' : row[index]));
  }
  // sort the data rows, then pre-pend the header row before returning.
  results.sort(function (a, b) { return a[0] - b[0] });
  results.unshift(headers);
  return results;
}