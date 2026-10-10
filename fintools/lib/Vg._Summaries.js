// vg.Summaries.gs - internal functions for the public cached versions in vg.SummariesCached.gs
// v12 - baselined functional from deployment v12 and later.
// v50 baseline.

/**
 * Retrieves ticker and optionally price, yield and selected attributes from Vanguard mutual funds summary page.
 * @param {1} [getPrice] (optional) 1 = return price (default), 0 = don't. 
 * @param {1} [getYield] (optional) 1 = return SEC yield (default), 0 = don't.
 * @param {0} [getID] (optional) 1 = return ID, 0 = don't (default).
 * @param {1} [getName] (optional) 1 = return name (default), 0 = don't.
 * @param {0} [getCategoryHigh] (optional) 1 = return category high, 0 = don't (default).
 * @param {0} [getAssetClass] (optional) 1 = return asset class, 0 = don't (default).
 * @param {0} [getCategoryLow] (optional) 1 = return category low, 0 = don't (default).
 * @param {0} [getExpenseRatio] (optional) 1 = return category low, 0 = don't (default).
 * @param {0} [getShareClass] (optional) 1 = return share class, 0 = don't (default).
 * @param {0} [getPriceAsOfDate] (optional) 1 = return Price as of date, 0 = don't (default).
 * @param {0} [getYieldAsOfDate] (optional) 1 = return Price as of date, 0 = don't (default).
 * @param {1} [includeInstitutional] (optional) 1 = include institutional funds (default), 0 = don't .
 * @return {[large 2D array of all values with entries per ticker by row]}.
 */
function vanguardGetPriceYieldAndAttributes_(getPrice = 1, getYield = 1, getID = 0, getName = 1, getCategoryHigh = 0, getAssetClass = 0, getCategoryLow = 0, getExpenseRatio = 0, getShareClass = 0, getPriceAsOfDate = 0, getYieldAsOfDate = 0, includeInstitutional = 1) {

  var data = [];
  // Populate header row
  var headerRow = ["Ticker"];                           // Header row with first column header (always included).
  if (getPrice) headerRow.push("Price");
  if (getYield) headerRow.push("SEC yield");
  if (getID) headerRow.push("ID");
  if (getName) headerRow.push("Name");
  if (getCategoryHigh) headerRow.push("Category high");
  if (getAssetClass) headerRow.push("Asset class");
  if (getCategoryLow) headerRow.push("Category low");
  if (getExpenseRatio) headerRow.push("Expense Ratio");
  if (getShareClass) headerRow.push("Share class");
  if (getPriceAsOfDate) headerRow.push("Price as of date");
  if (getYieldAsOfDate) headerRow.push("Yield as of date");
  data.push(headerRow);

  // Loop through the mutual funds (entities), extracting values or attributes of interest.
  // Path in Chrome dev tools looks something like: fund.entity.[0 … 99].0.dailyPrice.regular.price.
  // Note the conversion to a numeric value, for some values, by use of the "+" unary operator.

  // Iterate through two URLs that provide all the key fund attributes. They have the same structure one for MF, one for ETFs.
  const baseURLs = ["https://api.vanguard.com/rs/ire/01/ind/mf/month-end.jsonp?", "https://api.vanguard.com/rs/ire/01/ind/etf/month-end.jsonp?"];
  for (let urlIndex = 0; urlIndex < baseURLs.length; urlIndex++) {

    const options = { 'headers': { 'Referer': 'https://investor.vanguard.com' } };     // Same referer as for month-end view.
    const responseText = UrlFetchApp.fetch(baseURLs[urlIndex], options).getContentText();
    const json = jsonExtractAndParse_(responseText);
    let numRows = json.fund.entity.length;
    for (let row = 0; row < numRows; row++) {

      // If includeInstitutional flag not set, skip institutional share class funds 
      // by incrementing loop index for each institutional class fund in a row.
      // Done this way to avoid an additional level of if-then nesting for the main for-loop processing.
      if (!includeInstitutional) {
        while (row < numRows && json.fund.entity[row].profile.fundFact.isInstitutionalShare) {
          row++;
        }
      }
      // Required if last fund in not-institutional while-loop above was institutional.
      if (!(row < numRows)) break;

      var dataRow = [];
      // ticker is always included.
      dataRow.push(json.fund.entity[row].profile.ticker);

      if (getPrice) dataRow.push(vanguardNumber_(json.fund.entity[row].dailyPrice.regular.price));

      // Yield: some funds don't provide it, so must check.
      if (getYield) {
        const yield = json.fund.entity[row].yield.yieldPct;
        dataRow.push(vanguardNumber_(yield, 100));
      }

      if (getID) dataRow.push(json.fund.entity[row].profile.fundId);
      if (getName) dataRow.push(json.fund.entity[row].profile.longName);
      if (getCategoryHigh) dataRow.push(json.fund.entity[row].profile.fundCategory.high.name);
      if (getAssetClass) dataRow.push(json.fund.entity[row].profile.fundCategory.customizedHighCategoryName);
      if (getCategoryLow) dataRow.push(json.fund.entity[row].profile.fundCategory.low.name);
      if (getExpenseRatio) {
        const ratio = json.fund.entity[row].profile.expenseRatio;
        dataRow.push(vanguardNumber_(ratio, 100));
      }
      // Share class: requires checking three true/false attributes
      if (getShareClass) {
        let shareClass;
        if (json.fund.entity[row].profile.fundFact.isAdmiralShare) {
          shareClass = "Admiral";
        } else if (json.fund.entity[row].profile.fundFact.isInstitutionalShare) {
          shareClass = "Institutional";
        } else if (json.fund.entity[row].profile.fundFact.isInvestorShare) {
          shareClass = "Investor";
        } else {
          shareClass = "";
        }
        dataRow.push(shareClass);
      }
      if (getPriceAsOfDate) dataRow.push(duGetDateFromYYYYMMDD_(json.fund.entity[row].dailyPrice.regular.asOfDate.substring(0, 10)));
      if (getYieldAsOfDate) {
        const a = json.fund.entity[row].yield.asOfDate;
        dataRow.push((a && a.length) ? duGetDateFromYYYYMMDD_(a.substring(0, 10)) : "");
      }
      // All row columns now populated, so push row into data array.
      data.push(dataRow);
    }
  }
  return (data);
}

/**
 * Retrieves bond attributes from Vanguard mutual funds AND ETF summary pages bond attributes view.
 */
function vanguardGetBondAttributes_() {

  // Populate header row.
  var headerRow = [];
  headerRow.push("Ticker");
  headerRow.push("Name");
  headerRow.push("Duration");
  headerRow.push("Average maturity");
  headerRow.push("Yield to maturity");
  headerRow.push("Average coupon");
  headerRow.push("As of date");
  headerRow.push("Asset class");
  headerRow.push("Expense Ratio");
  var data = [];
  data.push(headerRow);

  const baseURLs = ["https://api.vanguard.com/rs/ire/01/ind/mf/attribute/bond.jsonp?", "https://api.vanguard.com/rs/ire/01/ind/etf/attribute/bond.jsonp?"];
  for (let urlIndex = 0; urlIndex < baseURLs.length; urlIndex++) {

    const options = { 'headers': { 'Referer': 'https://investor.vanguard.com' } };
    let responseText = UrlFetchApp.fetch(baseURLs[urlIndex], options).getContentText();
    const json = jsonExtractAndParse_(responseText);

    // Loop through funds (entities), and extract attributes of interest.
    let numRows = json.fund.entity.length;
    for (let row = 0; row < numRows; row++) {
      // Only interested in Bond Funds.
      if (json.fund.entity[row].profile.fundCategory.high.name == "Bond Funds") {
        let dataRow = [];
        // must initialize new row array on each pass.
        dataRow.push(safeObjectRef_(json.fund.entity[row].profile.ticker));
        dataRow.push(safeObjectRef_(json.fund.entity[row].profile.longName));
        const attributes = json.fund.entity[row].attributes;
        dataRow.push(vanguardNumber_(attributes.averageDuration));
        dataRow.push(vanguardNumber_(attributes.averageMaturity));
        dataRow.push(vanguardNumber_(attributes.yieldToMaturity, 100));
        dataRow.push(vanguardNumber_(attributes.averageCoupon, 100));

        const a = json.fund.entity[row].asOfDate;
        dataRow.push((a && a.length) ? duGetDateFromYYYYMMDD_(a.substring(0, 10)) : "");
        // Asset class
        dataRow.push(safeObjectRef_(json.fund.entity[row].profile.fundCategory.customizedHighCategoryName));
        dataRow.push(vanguardNumber_(json.fund.entity[row].profile.expenseRatio, 100));
        data.push(dataRow);
      }
    }
  }
  return data;
}

function vanguardNumber_(value, divisor = 1) {
  if (value == null || value === '') return '';
  const number = parseFloat(value);
  if (!Number.isFinite(number)) throw new Error('Invalid Vanguard numeric value: ' + value);
  return number / divisor;
}