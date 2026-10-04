// cloudFlare.gs

/**
 * Returns an array transformed of my REFCPI.csv
 * @param {boolean} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * @customfunction
 */
function cloudGetCachedREFCPI(forceRefresh = false) {
  const cacheKey = "cloudGetCachedREFCPI-v3aa-";
  const cache = new Cacher({
    cachePoint: CacheService.getDocumentCache()
  });

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      const cacheArray = JSON.parse(cacheVal);
      // header included.
      for (i in cacheArray.length) {
        if (cacheArray[i].date != null && cacheArray[i].date)
          cacheArray[i].date = mydateNormalize_(cacheArray[i].date);
        if (cacheArray[i].maxRefCpi != null && cacheArray[i].maxRefCpi)
          cacheArray[i].maxRefCpi = mydateNormalize_(cacheArray[i].maxRefCpi);
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
    const rows = text.slice().split("\n");

    function isoToNormal(ds) { return ds.substring(5, 7) + '/' + ds.substring(8, 10) + '/' + ds.substring(0, 4); }

    // Map the rows, split values from each row into an array
    const today = new Date;
    const oldestDate = new Date(today.getFullYear() - 3, today.getMonth(), 1);
    const result = [];
    for (let i = 1; i < rows.length - 1; i++) {
      const vals = rows[i].split(delimiter);
      if (vals.length != 6) throw `row length = ${vals.length}, text=${rows[i]}, aborting.`
      const date = mydateNormalize_(vals[0]);
      if (mydateLessThan_(date, oldestDate)) continue;
      result.push({
        date,
        refCpiNSA: Number(vals[1]),
        refCpiSa: Number(vals[2]),
        saFactor: Number(vals[3]),
        mmdd: vals[4],
        maxRefCpi: isoToNormal(vals[5]),
      });
    }
    return result;
  }
}