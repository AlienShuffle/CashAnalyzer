// ty.TreasuryYields.gs
// v12 - baselined functional from deployment v12 and later.
// v24 - convert them to percentages instead of basis point (e.g., 3% is now .03, not 3)
// v148 re-baseline.

/**
 * Returns treasury.gov CMT par yields, sorted by date, using the script cache.
 * Decimal rates (0.04 = 4%). Header starts with Date; real maturities: 5,7,10,20,30 years;
 * nominal: 1,2,3,4,6 months and 1,2,3,5,7,10,20,30 years.
 * YYYYMM requests the full year, not a month. Example: =treasuryGetCachedGovYields(2026, "real")
 * @param {string|number} [yearOrMonth] YYYY, YYYYMM, or "all"; omitted/blank uses the current year.
 * @param {string} [type="nominal"] Case-insensitive "real"; other strings select nominal.
 * @param {boolean} [forceRefresh=false] Bypass the cached table.
 * @return {Array<Array<Date|number|string>>} Header plus ascending data rows; missing maturities blank.
 * @customfunction
 */
function treasuryGetCachedGovYields(yearOrMonth, type = "nominal", forceRefresh = false) {
  if (type != null && typeof type !== 'string') throw new Error('Treasury yield type must be a string');
  yearOrMonth = yearOrMonth || new Date().getFullYear();

  const cacheKey = "treasuryGovYields-v157-" + type + "-" + yearOrMonth;
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

  const resp = treasuryGetCachedGovYields_(yearOrMonth, type);

  // log TTL calculations.
  const tradetime = new Date(Date.parse(resp[resp.length - 1][0]));
  const ttl = treasuryCalcCacheTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Retrieves Treasury yields from treasury.gov based upon a year or date input.
 * Note, this takes a month as input, but it appears that the Treasury site no longer supports months, only full years.
 * @param {201906} yearOrMonth [optional] YYYY for year, YYYYMM for month, or "all". Defaults to current year.
 * @param {"real"} type [optional] "real" for real yields, missing or any other value for nominal yields. 
 */
function treasuryGetCachedGovYields_(yearOrMonth, type = "nominal") {

  if (type != null && typeof type !== 'string') throw new Error('Treasury yield type must be a string');
  if (type)
    type = type.toLowerCase();

  // Setup date structure and base URL depending upon the type of data we are seeking.
  var url, columns, headers;
  if (type == 'real') {
    url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_real_yield_curve';
    columns = ["NEW_DATE", "TC_5YEAR", "TC_7YEAR", "TC_10YEAR", "TC_20YEAR", "TC_30YEAR"];
    headers = ["Date", "5 yr", "7 yr", "10 yr", "20 yr", "30 yr"];
  } else {
    type = 'nominal';
    url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve';
    columns = ["NEW_DATE", "BC_1MONTH", "BC_2MONTH", "BC_3MONTH", "BC_4MONTH", "BC_6MONTH", "BC_1YEAR", "BC_2YEAR", "BC_3YEAR", "BC_5YEAR", "BC_7YEAR", "BC_10YEAR", "BC_20YEAR", "BC_30YEAR"];
    headers = ["Date", "1 mo", "2 mo", "3 mo", "4 mo", "6 mo", "1 yr", "2 yr", "3 yr", "5 yr", "7 yr", "10 yr", "20 yr", "30 yr"];
  }

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
      //url += '&field_tdr_date_value=' + year + month;
      // just put in the year since months seems to be broken at treasury.gov
      url += '&field_tdr_date_value=' + year;
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
  /* XML entry looks like below (partial). Path is root -> 'entry' -> 'content' -> 'properties' -> data elements.
  <entry>
    <id>http://data.treasury.gov/Feed.svc/DailyTreasuryYieldCurveRateData(3286)</id>
    <title type="text"></title>
    <updated>2019-06-24T14:13:17Z</updated>
    <author>
      <name />
    </author>
    <link rel="edit" title="DailyTreasuryYieldCurveRateDatum" href="DailyTreasuryYieldCurveRateData(3286)" />
    <category term="TreasuryDataWarehouseModel.DailyTreasuryYieldCurveRateDatum" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme" />
    <content type="application/xml">
      <m:properties>
        <d:Id m:type="Edm.Int32">3286</d:Id>
        <d:NEW_DATE m:type="Edm.DateTime">2010-02-22T00:00:00</d:NEW_DATE>
        <d:BC_1MONTH m:type="Edm.Double">0.059999998658895493</d:BC_1MONTH>
  */

  // Navigate XML to get the data elements.
  const root = document.getRootElement();
  const namespace = root.getNamespace();                                       // Need namespace to get elements by name.
  const children = document.getRootElement().getChildren('entry', namespace);  // 'entry' is name of the top element of each data elements set.
  //Logger.log(children.length);

  var results = [];
  for (let i = 0; i < children.length; i++) {
    const content = children[i].getChild('content', namespace);  // 'content' is name of the grandparent element of each set of data elements.
    // Logger.log(content.getChildren()[0].getName());           // Just curiouse. It is 'properties'.
    const data = content.getChildren()[0].getChildren();         // First child of content is parent of data elements.
    var row = [];
    for (let j = 0; j < data.length; j++) {
      const name = data[j].getName();
      const value = data[j].getValue();

      switch (name) {
        // If the Name is 'NEW_DATE', it always goes in column 0;
        // Otherwise, place the values in the correct column as per the model to publish them.
        // Note, I did it this way to support the transition to adding 17 Week treasuries into display, old dates, will be missing
        // those entries.
        case 'NEW_DATE':
          row[0] = new Date(Date.parse(value));
          row[0].setHours(0);
          row[0].setMinutes(0);
          break;

        // Nominal values
        case 'BC_1MONTH':
        case 'BC_2MONTH':
        case 'BC_3MONTH':
        case 'BC_4MONTH':
        case 'BC_6MONTH':
        case 'BC_1YEAR':
        case 'BC_2YEAR':
        case 'BC_3YEAR':
        case 'BC_5YEAR':
        case 'BC_7YEAR':
        case 'BC_10YEAR':
        case 'BC_20YEAR':
        case 'BC_30YEAR':
        // TIPS values
        case 'TC_5YEAR':
        case 'TC_7YEAR':
        case 'TC_10YEAR':
        case 'TC_20YEAR':
        case 'TC_30YEAR':
          const index = columns.indexOf(name);
          if (index < 0) break;
          row[index] = value/100;
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