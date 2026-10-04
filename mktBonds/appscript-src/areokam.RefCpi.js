// cloudFlare.gs

/**
 * Returns an array transformed of KevinM/aerokam's RefCpiNsaSa.csv
 * Currently limited to the latest 3 years of data to reduce processing overhead.
 * 
 * @param {boolean} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * 
 * @returns [{date,refCpiNsa,refCpiSa,saFactor,mmdd}]
 * @customfunction
 */
function cloudGetCachedAerokamRefCpi(forceRefresh = false) {
  const cacheKey = "cloudGetCachedAerokamRefCpi-v3.1-";
  const cache = new Cacher({
    cachePoint: CacheService.getDocumentCache()
  });

  // retrieve a previously cached report if it has not timed out or forced quote by caller.
  if (!forceRefresh) {
    const cacheVal = cache.get(cacheKey);
    // parse the stored JSON if it exists and return to the caller.
    if (cacheVal != null && cacheVal.substring(0, 7) != 'failed:') {
      const cacheArray = JSON.parse(cacheVal);
      for (i = 0; i < cacheArray.length; i++) {
        if (cacheArray[i].date != null && cacheArray[i].date)
          cacheArray[i].date = mydateNormalize_(cacheArray[i].date);
      }
      //Logger.log("cached:" + cacheArray)
      return cacheArray;
    }
  }
  const factors = cloudGetKMSaFactorsCsv_();

  // set ttl for 11AM as the CPI normally are not updated after 9AM. A user could force a refresh if necessary.
  const ttl = cacheCalcTTLAfterHour_(11);
  cacheLogTTL_(cacheKey, new Date, ttl);
  const json = JSON.stringify(factors);
  cache.set(cacheKey, json, ttl);
  //Logger.log("cached:" + json);
  return factors;

  function cloudGetKMSaFactorsCsv_() {
    const url = 'https://pub-ba11062b177640459f72e0a88d0261ae.r2.dev/TIPS/RefCpiNsaSa.csv'

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

    // Map the rows, split values from each row into an array.
    const today = new Date;
    const oldestDate = new Date(today.getFullYear() - 3, today.getMonth(), 1);
    const result = [];
    for (let i = 1; i < rows.length - 1; i++) {
      const vals = rows[i].split(delimiter);
      const date = mydateNormalize_(vals[0]);
      if (mydateLessThan_(date, oldestDate)) continue;
      result.push({
        date,
        refCpiNSA: Number(vals[1]),
        refCpiSa: Number(vals[2]),
        saFactor: Number(vals[3]),
        mmdd: 'M' + ((date.getMonth() + 1 + '')).padStart(2, '0') + (date.getDate() + '').padStart(2, '0')
      });
    }
    return result;
  }
}
