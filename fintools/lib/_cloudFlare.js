// cloudFlare.gs
// v114 - first version of cloudFlare backend logic.
// v137 - more defensive exception handling.
// v138 - added cloudGetDistributionHistoryJson_

// This starts the cloudFlare interface, this is the interface with the site structure only.

/**
 * retrieves the contents of the file in the Cash Optimizer cloudFlare respository named by the URL
 * sub-path provided.
 * 
 * @param  urlPath sub-path (after hostname) that references the resource file of interest.
 * @returns stringFileContents
 * @customfunction
 */
function cloudGetFileContents_(urlSubPath) {
  const url = 'https://cashoptimizer.pages.dev/' + urlSubPath;
  let resp;
  try {
    resp = UrlFetchApp.fetch(url);
  } catch (err) {
    throw 'failed URL retreival =' + url;
  }
  const content = resp.getContentText();
  if (content.length < 1) throw 'empty file: ' + url;
  // if the browser returns an HTML file, it did not find the file.
  if (content.indexOf('<html>') > -1)
    throw 'HTML found, url =' + url;
  return content;
}
/**
 * return the contents of an Distribution history file (full history)
 */
function cloudGetDistributionHistoryJson_(ticker) {
  // example: https://cashoptimizer.pages.dev/Funds/USFR/USFR-distros.json
  const subPath = 'Funds/' + ticker + '/' + ticker + '-distros.json';
  return jsonParse_(cloudGetFileContents_(subPath));
}
/**
 * return the contents of an EDGAR history file (full history)
 */
function cloudGetEDGARReportContents_(ticker) {
  // example: https://cashoptimizer.pages.dev/EDGAR/SPRXX/EDGAR-SPRXX-reports.json
  const subPath = 'EDGAR/' + ticker + '/EDGAR-' + ticker + '-reports.json';
  return cloudGetFileContents_(subPath);
}
/**
 * return the contents of an EDGAR history file (full history)
 */
function cloudGetYieldHistoryJson_(ticker) {
  // example: https://cashoptimizer.pages.dev/MM/SPRXX/SPRXX-rate-history.json
  const subPath = 'MM/' + ticker + '/' + ticker + '-rate-history.json';
  return jsonParse_(cloudGetFileContents_(subPath));
}

/**
 * return the contents of an EDGAR history file (full history)
 */
function cloudGetCurrentYieldsJson_() {
  // target: https://cashoptimizer.pages.dev/MM/all-rates.json
  const subPath = 'MM/all-rates.json';
  return jsonParse_(cloudGetFileContents_(subPath));
}
