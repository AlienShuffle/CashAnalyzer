// cnbc.getPrice.gs

/**
 * Returns CNBC's market price for stocks/ETFs, Do Not use for mutual funds.
 * Uses the document cache when available, otherwise the script cache.
 * Date preserves the source epoch instant; Sheets controls its displayed timezone.
 * Tries header quote, then 5D and 1M charts. Header changePct is decimal or "" if unavailable;
 * chart fallbacks return only [[asOf, price]]. The 1M fallback uses 16:00 local time.
 * Throws for missing/invalid quote data. Example: =cnbcGetCachedPrice("VTI", false)
 * @param {string} ticker Cnbc ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, price, changePct]]
 * @customfunction
 */
function cnbcGetCachedPrice(ticker, forceRefresh = false) {
  const cacheKey = `cnbc-v160-5D-f-${ticker}`;
  const cache = CacheService.getDocumentCache() || CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      // convert JSON string date back to a javascript date. Man, dates are annoying.
      if (cacheArray[0][0])
        cacheArray[0][0] = new Date(cacheArray[0][0]);
      return cacheArray;
    }
  }

  // Prefer the header quote, then fall back to 5D and 1M chart data.
  let resp = cnbcPriceByQuote_(ticker);
  if (typeof resp === 'undefined' || resp == null || resp.length === 0) {
    Logger.log(`No CNBC Header quote for ${ticker}`);
    resp = cnbcPriceFromChart_(ticker, "5D");
    if (typeof resp === 'undefined' || resp == null || resp.length === 0) {
      Logger.log(`No CNBC 5D quote for ${ticker}`);
      resp = cnbcPriceFromChart_(ticker, "1M");
      if (typeof resp === 'undefined' || resp == null || resp.length === 0) throw new Error(`No CNBC 1M quote for ${ticker}`);
      // make the time 16:00 so it looks like a closing time.
      resp[0][0].setHours(16, 0, 0, 0);
    }
  }

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns CNBC's chart price on or before the requested calendar day.
 * Uses the document cache when available, otherwise the script cache.
 * Selects the latest valid trading bar on or before that day, preserving its actual local Date.
 * Throws for invalid dates or when the selected range has no qualifying price.
 * Example: =cnbcGetCachedDatedPrice("VTI", "2026-10-01", "1Y", false)
 * @param {string} ticker CNBC ticker.
 * @param {Date|string|number} priceDate Date, M/D/YYYY, YYYY-MM-DD or Excel 1900-system serial.
 * @param {string} [period="1Y"] CNBC chart range to search for a price on or before the day.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number>>} [[asOf, price]]
 * @customfunction
 */
function cnbcGetCachedDatedPrice(ticker, priceDate, period = "1Y", forceRefresh = false) {
  const priceDateKey = cnbcPriceDateKey_(ticker, priceDate);
  const cacheKey = `cnbcGetCachedDatedPrice-v2-${ticker}-${period}-${priceDateKey}`;
  const cache = CacheService.getDocumentCache() || CacheService.getScriptCache();
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      cacheArray[0][0] = new Date(cacheArray[0][0]);
      return cacheArray;
    }
  }

  const resp = cnbcDatedPriceFromChart_(ticker, period, priceDateKey);
  if (!resp || resp.length === 0) {
    throw new Error(`No valid CNBC ${period} price for ${ticker} on or before ${priceDateKey}`);
  }
  const tradetime = resp[0][0];
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns CNBC's market price NAV for mutual funds.
 * Only provides daily updates not intraday for ETF/stocks.
 * Uses the document cache when available, otherwise the script cache.
 * Date preserves the source epoch instant; Sheets controls its displayed timezone.
 * Throws for missing/invalid quote data. Example: =cnbcGetCachedPriceMutualFund("VTSAX", false)
 * @param {string} ticker Cnbc mutual fund ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[asOf, price]]
 * @customfunction
 */
function cnbcGetCachedPriceMutualFund(ticker, forceRefresh = false) {
  const cacheKey = `cnbcGetCachedPriceMutualFund-v160-5D-f-${ticker}`;
  const cache = CacheService.getDocumentCache() || CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      // convert JSON string date back to a javascript date. Man, dates are annoying.
      if (cacheArray[0][0])
        cacheArray[0][0] = new Date(cacheArray[0][0]);
      return cacheArray;
    }
  }

  // lookup header quote.
  let resp = cnbcPriceByQuote_(ticker);
  if (typeof resp === 'undefined' || resp == null || resp.length === 0) {
    // if no header quote, fallback to 1M chart data.
    Logger.log(`No CNBC Header quote for ${ticker}`);
    resp = cnbcPriceFromChart_(ticker, "1M");
    if (typeof resp === 'undefined' || resp == null || resp.length === 0) throw new Error(`No CNBC 1M quote for ${ticker}`);
  }
  // remove changePct if we got it, not supported for Mutual Funds.
  if (resp[0].length === 3) resp[0].pop();

  // log TTL calculations.
  const tradetime = resp[0][0]
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

/**
 * Returns CNBC's market 52w High/Low values for the ticker symbol: stocks,ETF, indexes, or mutual funds.
 * Uses the document cache when available, otherwise the script cache.
 * Slash dates (M/D/YY or M/D/YYYY) and YYYY-MM-DD use local midnight.
 * Two-digit years mean 2000-2099; timestamp dates preserve the source instant.
 * Throws for missing/invalid quote data. Example: =cnbcGetCached52wHighLow("VTSAX", false)
 * @param {string} ticker CNBC ticker.
 * @param {boolean} [forceRefresh=false] Bypass the cached quote.
 * @return {Array<Array<Date|number|string>>} [[highDateObj, priceHigh, lowDateObj, priceLow]]
 * @customfunction
 */
function cnbcGetCached52wHighLow(ticker, forceRefresh = false) {
  const cacheKey = `cnbcGetCached52wHighLow-v163-b-${ticker}`;
  const cache = CacheService.getDocumentCache() || CacheService.getScriptCache();

  // retrieve a previously cached quote if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null) {
      const cacheArray = JSON.parse(cacheVal);
      // convert JSON string date back to a javascript date. Man, dates are annoying.
      if (cacheArray[0][0]) {
        cacheArray[0][0] = new Date(cacheArray[0][0]);
      }
      if (cacheArray[0][2]) {
        cacheArray[0][2] = new Date(cacheArray[0][2]);
      }
      return cacheArray;
    }
  }

  // lookup header quote.
  const resp = cnbcHighLowByQuote_(ticker);
  if (!resp || resp.length === 0) throw new Error(`No valid CNBC 52w high/low quote for ${ticker}`);

  // log TTL calculations use current time as there is not trade time on these.
  const tradetime = new Date;
  const ttl = cacheCalcTTL_(tradetime);
  cacheLogTTL_(cacheKey, tradetime, ttl);

  // store the price quote for future use.
  cache.put(cacheKey, JSON.stringify(resp), ttl);
  return resp;
}

function testQuote() {
  cnbcPriceFromChart_(".SPX","1Y");
}

// internal retrieval function to find a Ticker's price by using the top level quote service.
function cnbcPriceByQuote_(ticker) {

  const quote = cnbcQuoteJson_(ticker);
  const lastPrice = quote?.last;
  const effectiveDate = quote?.last_time;
  const changePctStr = quote?.change_pct;
  const price = Number(typeof lastPrice === "string" ? lastPrice.replace(/,/g, "") : lastPrice);
  if (lastPrice == null || !Number.isFinite(price) || price <= 0 || typeof effectiveDate !== "string" || !effectiveDate.trim()) {
    Logger.log(`No valid price or effective date for ${ticker}`);
    return;
  }

  // date is of form 2026-10-12T16:10:00.000-0400 or 2026-10-12
  const dateObj = (effectiveDate.length == 10) ?
    duGetDateFromYYYYMMDD_(effectiveDate)
    :
    new Date(effectiveDate);
  if (!(dateObj instanceof Date) || !Number.isFinite(dateObj.getTime())) {
    Logger.log(`Invalid CNBC quote date for ${ticker}: ${effectiveDate}`);
    return;
  }

  let changePct = "";
  if (typeof changePctStr === "string" && /^[+-]?\d+(?:\.\d+)?%?$/.test(changePctStr.trim())) {
    const parsedChange = Number(changePctStr.trim().replace("%", "")) / 100;
    if (Number.isFinite(parsedChange)) changePct = Number(parsedChange.toFixed(4));
  }
  if (changePct === "") Logger.log(`No valid CNBC change percentage for ${ticker}: ${changePctStr}`);

  return [[dateObj, price, changePct]];
}
// internal retrieval function to find a Ticker's price by using the top level quote service.
function cnbcHighLowByQuote_(ticker) {

  const quote = cnbcQuoteJson_(ticker);

  const highPrice = quote?.yrhiprice;
  const highDate = quote?.yrhidate;
  const priceHighVal = Number(typeof highPrice === "string" ? highPrice.replace(/,/g, "") : highPrice);
  if (
    highPrice == null ||
    !Number.isFinite(priceHighVal) ||
    priceHighVal <= 0 ||
    typeof highDate !== "string" ||
    !highDate.trim()
  ) {
    Logger.log(`No valid 52w high price or effective date for ${ticker}`);
    return;
  }
  const highDateObj = cnbcHighLowDate_(highDate);
  if (
    !(highDateObj instanceof Date) ||
    !Number.isFinite(highDateObj.getTime())
  ) {
    Logger.log(`Invalid CNBC 52w high quote date for ${ticker}: ${highDate}`);
    return;
  }

  const lowPrice = quote?.yrloprice;
  const lowDate = quote?.yrlodate;
  const priceLowVal = Number(typeof lowPrice === "string" ? lowPrice.replace(/,/g, "") : lowPrice);
  if (
    lowPrice == null ||
    !Number.isFinite(priceLowVal) ||
    priceLowVal <= 0 ||
    typeof lowDate !== "string" ||
    !lowDate.trim()
  ) {
    Logger.log(`No valid 52w low price or effective date for ${ticker}`);
    return;
  }
  const lowDateObj = cnbcHighLowDate_(lowDate);
  if (
    !(lowDateObj instanceof Date) ||
    !Number.isFinite(lowDateObj.getTime())
  ) {
    Logger.log(`Invalid CNBC 52w low quote date for ${ticker}: ${lowDate}`);
    return;
  }

  return [[highDateObj, priceHighVal * 1, lowDateObj, priceLowVal * 1]];
}

function cnbcHighLowDate_(value) {
  const text = value.trim();
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (slash || iso) {
    const year = slash ?
      Number(slash[3]) + (slash[3].length === 2 ? 2000 : 0) : Number(iso[1]);
    const month = Number(slash ? slash[1] : iso[2]);
    const day = Number(slash ? slash[2] : iso[3]);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return new Date(NaN);
    }
    return date;
  }
  // Do not let runtime-dependent slash parsing reinterpret malformed calendar dates.
  return text.includes("/") ? new Date(NaN) : new Date(text);
}

// internal retrieval function to find a Ticker's price by using the top level quote service.
function cnbcQuoteJson_(ticker) {

  const url = `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(ticker)}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1`;
  const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/118.0.5993.117 Safari/537.36";

  const options = {
    headers: {
      'Referer': 'https://quote.cnbc.com/',
      "User-Agent": USER_AGENT
    }
  };

  const responseRaw = UrlFetchApp.fetch(url, options);
  const responseText = responseRaw.getContentText();
  const json = JSON.parse(responseText);
  const quote = json?.FormattedQuoteResult?.FormattedQuote?.[0];
  return quote;
}

// internal retrieval function using the chart service.
function cnbcPriceFromChart_(ticker, period) {
  return cnbcChartPrice_(ticker, period);
}

function cnbcChartPrice_(ticker, period, priceDateKey) {

  // Function to convert a string like "20250430000000" to ISO date "YYYY-MM-DD"
  const convertToISODate = (dateStr) => `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  // new Date(year, monthIndex, day, hours, minutes, seconds)
  const convertToDateTime = (dateStr) => new Date(
    dateStr.slice(0, 4),
    dateStr.slice(4, 6) - 1,
    dateStr.slice(6, 8),
    dateStr.slice(8, 10),
    dateStr.slice(10, 12),
    dateStr.slice(12, 14)
  );
  // consider valid trades between the times between 09:30 and 16:05 (4:05 PM)
  // any trade outside this window is considered outside the trading day.
  // times of 000000 are valid (they are end of date for the trading day)
  const isTimeOutsideTradingDay = (dateStr) => {
    // allow end of day trades with time 000000
    if (dateStr.slice(8, 14) === "000000") return 0;
    return dateStr.slice(8, 10) * 1 < 9 ||
      (dateStr.slice(8, 10) * 1 === 9 && dateStr.slice(10, 12) * 1 < 30) ||
      dateStr.slice(8, 10) * 1 > 16 ||
      (dateStr.slice(8, 10) * 1 === 16 && dateStr.slice(10, 12) * 1 >= 5) ?
      1 : 0;
  };


  // build a url for a given ticker and time range to fetch the yield history from cnbc.
  function buildUrl(symbol, timeRange) {
    const base = "https://webql-redesign.cnbcfm.com/graphql";
    const params = {
      operationName: "getQuoteChartData",
      variables: JSON.stringify({ symbol, timeRange }),
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: "9e1670c29a10707c417a1efd327d4b2b1d456b77f1426e7e84fb7d399416bb6b"
        }
      })
    };
    return base + "?" + Object.entries(params).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  }

  let resp = [];
  // 1Y = 1 year, 1M = 1 month, 5D = 5 days, 1D = 1 day
  // use 5D to get more recent (intra-day values even on non-trading days)
  // use 1Y to get a history for back testing for MM Optimizer.
  // This routine is intended for daily ticker updates.
  const url = buildUrl(ticker, period);
  const responseRaw = UrlFetchApp.fetch(url);
  const responseText = responseRaw.getContentText();
  const json = JSON.parse(responseText);

  //const lastPrice = json.data?.chartData?.allSymbols[0].last * 1;
  //Logger.log(`lastPrice=${lastPrice}`);

  const priceBars = json.data?.chartData?.priceBars;
  if (!priceBars || priceBars.length == 0) {
    Logger.log(`No CNBC ${period} price bars for ${ticker}`);
    return;
  }
  const dateList = priceBars.map(bar => bar.tradeTime);
  const closeList = priceBars.map(bar => bar.close);
  // filter partial price updates, currently the date appears wrong.
  const partialList = priceBars.map(bar =>
    bar.low === "0.00" ||
    bar.volume === null
  );

  for (let i = 0; i < dateList.length; i++) {
    if (partialList[i]) {
      Logger.log(`partialList[${i}] is true`);
      continue;
    }
    if (typeof dateList[i] !== "string" || !/^\d{14}$/.test(dateList[i])) {
      Logger.log(`Invalid trade date for ticker ${ticker}: ${dateList[i]}`);
      continue;
    }
    if (priceDateKey && convertToISODate(dateList[i]) > priceDateKey) continue;
    if (priceDateKey && isTimeOutsideTradingDay(dateList[i])) {
      Logger.log(`Trade time outside trading day for ticker ${ticker} on ${dateList[i]}`);
      continue;
    }
    const asOfDate = convertToDateTime(dateList[i]);
    if (!Number.isFinite(asOfDate.getTime())) {
      Logger.log(`Invalid trade date for ticker ${ticker}: ${dateList[i]}`);
      continue;
    }
    if (!closeList[i] || closeList[i] === 1.0 || closeList[i] === 1) {
      Logger.log(`closeList[${i}] is 1`);
      continue;
    }
    const close = closeList[i] * 1;
    if (!Number.isFinite(close)) {
      Logger.log(`Invalid close for ticker ${ticker} on ${asOfDate}: ${closeList[i]}`);
      continue;
    }
    if (close === 0 || close === 0.01) {
      Logger.log(`closeList[${i}] is 0`);
      continue;
    }
    resp.push({
      originalDate: dateList[i],
      date: asOfDate,
      close: close,
    });
  }
  if (resp.length === 0) {
    Logger.log(`No valid CNBC ${period} price bars for ${ticker}${priceDateKey ? ` on or before ${priceDateKey}` : ""}`);
    return;
  }
  if (isTimeOutsideTradingDay(resp[resp.length - 1].originalDate)) {
    Logger.log(`Trade time outside trading day for ticker ${ticker} on ${resp[resp.length - 1].originalDate}`);
    return;
  }
  const latestItem = resp.reduce((latest, current) => {
    return new Date(current.date) > new Date(latest.date) ? current : latest;
  });
  return [[latestItem.date, latestItem.close]];
}
/**
 * Returns [[asOf, price]] for the latest valid trading bar on or before priceDate.
 * Accepts a Date, date string or Excel 1900-system serial, using local calendar dates.
 * Logs and returns undefined when period has no valid bar on or before priceDate.
 */
function cnbcDatedPriceFromChart_(ticker, period = "1Y", priceDate = "10/01/2026") {
  return cnbcChartPrice_(ticker, period, cnbcPriceDateKey_(ticker, priceDate));
}

function cnbcPriceDateKey_(ticker, priceDate) {
  let date = new Date(NaN);
  // Library callers can supply Dates from a different JavaScript realm.
  if (Object.prototype.toString.call(priceDate) === "[object Date]") {
    date = new Date(priceDate.getTime());
  } else if (typeof priceDate === "string") {
    date = cnbcHighLowDate_(priceDate);
  } else if (typeof priceDate === "number" && Number.isFinite(priceDate) &&
    priceDate >= 1 && priceDate < 2958466 && Math.floor(priceDate) !== 60) {
    const day = Math.floor(priceDate);
    // Excel includes a fictitious 1900-02-29 at serial 60; ignore fractional time.
    const serialDate = new Date(Date.UTC(1899, 11, 31) + (day - (day > 60 ? 1 : 0)) * 86400000);
    date = new Date(serialDate.getUTCFullYear(), serialDate.getUTCMonth(), serialDate.getUTCDate());
  }
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid CNBC priceDate for ${ticker}: ${priceDate}`);
  }
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
