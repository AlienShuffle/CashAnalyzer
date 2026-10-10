// ty.RecentTreasuryYields.gs
// v12 - baselined functional from deployment v12 and later.
// v24 - convert them to percentages instead of basis point (e.g., 3% is now .03, not 3)
// v148 - re-baseline.

/**
 * Pull from cache if available and finds the TIPS rates for the current month.
 * returns [[large_array sort by date]]
 * 
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
function treasuryGetCachedRecentRealYields(forceRefresh = false) {

  const cacheKey = "recentTreasuryRealYields-pct";
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (i = 1; i < cacheArray.length; i++)
        cacheArray[i][0] = new Date(cacheArray[i][0]);
      return cacheArray;
    }
  }

  const resp = treasuryGetRecentRealYields_();

  // log TTL calculations.
  const tradetime = new Date(Date.parse(resp[resp.length - 1][0]));
  const ttl = treasuryCalcCacheTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Retrieve the Month to date daily Real Treasury Yields.
 * @returns [[large_array]]
 */
function treasuryGetRecentRealYields_() {
  const url = 'https://home.treasury.gov/sites/default/files/interest-rates/real_yield.xml';

  var rawXml = UrlFetchApp.fetch(url).getContentText();

  var dataTable = [];
  const headerRow = ["Date", "5 Year", "7 Year", "10 Year", "20 Year", "30 Year"];
  dataTable.push(headerRow);

  for (let i = 0; i < 31; i++) {
    let dataRow = [];
    let tag = "TIPS_CURVE_DATE";

    // no more days left in data.
    if (rawXml.indexOf(tag) < 0)
      break;

    rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
    dataRow[0] = new Date(Date.parse(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">"))));

    // Note! the inputs are in an odd order, the indices are correct to sort them in shortest to longest duration.
    tag = "TC_30YEAR";
    rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
    dataRow[5] = parseFloat(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">")))/100;

    tag = "TC_20YEAR";
    rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
    dataRow[4] = parseFloat(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">")))/100;

    tag = "TC_5YEAR";
    rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
    dataRow[1] = parseFloat(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">")))/100;

    tag = "TC_7YEAR";
    rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
    dataRow[2] = parseFloat(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">")))/100;

    tag = "TC_10YEAR";
    rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
    dataRow[3] = parseFloat(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">")))/100;

    dataTable.push(dataRow);
    //Logger.log("TABLE LENGTH = %s",dataTable.length)
  }
  return dataTable;
}

/**
 * Pull from cache if available and finds the nominal CMT rates for the current month.
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @returns [[large_array]]
 * @customfunction
 */
function treasuryGetCachedRecentNominalYields(forceRefresh = false) {

  const cacheKey = "recentTreasuryNominalYields";
  const cache = CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      for (i = 1; i < cacheArray.length; i++)
        cacheArray[i][0] = new Date(cacheArray[i][0]);
      return cacheArray;
    }
  }

  const resp = treasuryGetRecentNominalYields_();

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
function treasuryGetRecentNominalYields_() {
  const url = 'https://home.treasury.gov/sites/default/files/interest-rates/yield.xml';

  var rawXml = UrlFetchApp.fetch(url).getContentText();

  var dataTable = [];
  const headerRow = ["Date", "1mo.", "2mo.", "3mo.", "4mo.", "6mo.", "1 Year", "2 Year", "3 Year", "5 Year", "7 Year", "10 Year", "20 Year", "30 Year"];
  dataTable.push(headerRow);

  for (let i = 0; i < 31; i++) {
    let dataRow = [];

    // start with finding the next date.
    let tag = "BID_CURVE_DATE";

    // no more days left in data.
    if (rawXml.indexOf("<" + tag + ">") < 0)
      break;

    // grab the current date and move past it.
    rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
    dataRow[0] = new Date(Date.parse(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">"))));
    //var openTagIndex = nominalRawXML.indexOf("</" + tag + ">");
    //var closeTagIndex = "</".concat(tag, ">").length;
    rawXml = rawXml.substring(rawXml.indexOf("</" + tag + ">") + "</".concat(tag, ">").length);

    const mktClosedTag = "<BOND_MKT_UNAVAIL>FEDERAL HOLIDAY</BOND_MKT_UNAVAIL>";
    // skip days when the market is closed and no rates are reported.
    // we know this because the market closed tag will be seen before the next date.
    var mktIndex = rawXml.indexOf(mktClosedTag);
    var tagIndex = rawXml.indexOf("<" + tag + ">");
    if (mktIndex > 0 && mktIndex < tagIndex) {
      rawXml = rawXml.substring(rawXml.indexOf(mktClosedTag) + mktClosedTag.length);
      continue;
    }

    // Unlike TIPS, the nominal rates are in a reasonable order!
    const tags = ["BC_1MONTH", "BC_2MONTH", "BC_3MONTH", "BC_4MONTH", "BC_6MONTH", "BC_1YEAR", "BC_2YEAR", "BC_3YEAR", "BC_5YEAR", "BC_7YEAR", "BC_10YEAR", "BC_20YEAR", "BC_30YEAR"];
    for (let j = 0; j < tags.length; j++) {
      tag = tags[j];
      rawXml = rawXml.substring(rawXml.indexOf("<" + tag + ">"));
      dataRow[j + 1] = parseFloat(rawXml.substring(tag.length + 2, rawXml.indexOf("</" + tag + ">")))/100;
      rawXml = rawXml.substring(rawXml.indexOf("</" + tag + ">") + "</" + tag + ">".length);
    }

    // jump to the next section headed by <G_NEW_DATE>
    tag = "<G_NEW_DATE>";
    rawXml = rawXml.substring(rawXml.indexOf(tag) + tag.length);

    dataTable.push(dataRow);
    //Logger.log("TABLE LENGTH = %s",dataTable.length)
  }
  return dataTable;
}

// Calculate an age on the treasuries query and use that to estimate how long it may remain useful in the cache (in seconds).
function treasuryCalcCacheTTL_(t) {

  // get the time and day of the most recent trade of the reference ticker symbol. Passed in as a parameter.
  var tradetime;
  if (t) {
    tradetime = new Date(Date.parse(t));
  } else {
    // if we don't get a date, then use yesterday.
    tradetime = new Date;
    tradetime.setDate(tradetime.getDate() - 1);
    tradetime.setHours(0);
    tradetime.setMinutes(0);
  }
  const tradetimeDayOfMonth = tradetime.getDate();
  const tradetimeMonth = tradetime.getMonth();
  const tradetimeYear = tradetime.getFullYear();

  // breakdown NYC time.
  const nycDate = timeGetNYCTime_();
  const nycHours = nycDate.getHours();
  const nycDayOfWeek = nycDate.getDay();
  const nycDayOfMonth = nycDate.getDate();
  const nycMonth = nycDate.getMonth();
  const nycYear = nycDate.getFullYear();

  // if the query is from a previous year, we can only refresh once a month, ridiculous that it will run that long :-)
  // but only if the tradetime date range for the report is greater than 31 days old.
  // 1 day in milliseconds is 1000 ms * 60 secs * 60 min * 24 hours =  86,400,000 ms
  if (tradetimeYear < nycYear && ((nycDate - tradetime) > (1000 * 60 * 60 * 24 * 31)))
    return 30 * 24 * 60 * 60;

  // if it is the weekend, let's cache to refresh between 3-4PM on Monday).
  if (nycDayOfWeek == 0 || nycDayOfWeek == 6)
    return (nycHours < 15) ? (15 - nycHours) * 60 * 60 : (39 - nycHours) * 60 * 60;

  // if tradetime is today we have updated prices for today, we can skip until tomorrow 3 to 4pm.
  if (tradetimeYear == nycYear && tradetimeMonth == nycMonth && tradetimeDayOfMonth == nycDayOfMonth) {
    // Let's calculate the remaining time before tomorrows 4pm true up.
    return (nycHours < 15) ? (15 - nycHours) * 60 * 60 : (24 + 15 - nycHours) * 60 * 60;
  }

  // If time is before 3pm, update expected between 3:45 and 5pm today.
  // Update every 20 minutes between 3pm and 7pm, other hours, evenings, go 4 just in case.
  if (nycHours < 15)
    return (15 - nycHours) * 60 * 60;
  if (nycHours >= 15 && nycHours < 19)
    return 20 * 60;
  return 4 * 60 * 60;
}