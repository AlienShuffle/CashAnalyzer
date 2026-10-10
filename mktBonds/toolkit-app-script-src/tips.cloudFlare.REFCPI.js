// cloudFlare.gs


/**
 * Returns REFCPI.csv as a worksheet table with a header row and six columns.
 * Dates are returned as Date values; CPI values and factors are numbers.
 * @param {boolean} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @return {Array<Array<Date|number|string>>} Date, REFCPINSA, REFCPISA, SAFactor, MMDD, maxREFCPI.
 * @customfunction
 */
function tipsGetCachedREFCPI(forceRefresh = false) {
  const rows = cloudGetCachedREFCPI_(forceRefresh);
  return [
    ['Date', 'REFCPINSA', 'REFCPISA', 'SAFactor', 'MMDD', 'maxREFCPI'],
    ...rows.map(row => [
      mydateNormalize_(row.date),
      row.refCpiNSA,
      row.refCpiSa,
      row.saFactor,
      row.mmdd,
      mydateNormalize_(row.maxRefCpi),
    ]),
  ];
}

/**
 * Returns an array transformed of my REFCPI.csv
 * @param {boolean} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 */
function cloudGetCachedREFCPI_(forceRefresh = false) {
  const cacheKey = "cloudGetCachedREFCPI-v4-";
  const cache = new Cacher({
    cachePoint: CacheService.getDocumentCache()
  });

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      const cacheArray = JSON.parse(cacheVal);
      for (const row of cacheArray) {
        row.date = mydateNormalize_(row.date);
        row.maxRefCpi = mydateNormalize_(row.maxRefCpi);
      }
      //Logger.log("cached:" + cacheArray)
      return cacheArray;
    }
  }
  const factors = cloudGetREFCPICsv_();

  // set ttl for 11AM as the CPI normally are not updated after 9AM. A user could force a refresh if necessary.
  const ttl = cacheCalcTTLAfterHour_(11);
  cacheLogTTL_(cacheKey, new Date, ttl);
  const json = JSON.stringify(factors);
  cache.set(cacheKey, json, ttl);
  //Logger.log("cached:" + json);
  return factors;

  function cloudGetREFCPICsv_() {
    const url = 'https://cashoptimizer.pages.dev/Treasuries/REFCPI.csv';

    let resp;
    try {
      resp = UrlFetchApp.fetch(url);
    } catch (err) {
      throw 'failed URL retreival =' + url;
    }
    const text = resp.getContentText();
    if (text.length < 1) throw 'empty file: ' + url;
    // if the browser returns an HTML file, it did not find the file.
    if (text.indexOf('<html>') > -1)
      throw 'HTML found, url =' + url;

    // parse CSV file
    // slices up the .CVS file contents stored in str and creates a matrix that is n rows long and y columns wide.
    const delimiter = ',';
    // use split to create an array of each csv value row
    const rows = text.trimEnd().split("\n");

    // Map the rows, split values from each row into an array
    const today = new Date;
    // limit to the last 10 years for performance reasons. (it may not always be longer)
    const oldestDate = new Date(today.getFullYear() - 10, today.getMonth(), 1);
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const vals = rows[i].trim().split(delimiter);
      if (vals.length != 6) throw `row length = ${vals.length}, text=${rows[i]}, aborting.`
      const date = mydateNormalize_(vals[0]);
      if (mydateLessThan_(date, oldestDate)) continue;
      result.push({
        date,
        refCpiNSA: Number(vals[1]),
        refCpiSa: Number(vals[2]),
        saFactor: Number(vals[3]),
        mmdd: vals[4],
        maxRefCpi: mydateNormalize_(vals[5]),
      });
    }
    return result;
  }
}