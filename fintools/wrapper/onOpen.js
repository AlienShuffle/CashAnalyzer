// onOpen.gs - this is a basic template for any sheet that uses Caching.
// v0.01 - 4/8/2023 - stripped down version for reference.
// 9/6/2025 - mild refactoring/best practices.

// Creates a menu item on the Google Sheets menubar for manual execution.
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Portfolio')
    .addItem('Reload Custom Functions', 'forceCustomFunctionReload')
    .addItem('Force Cache Update', 'forceCacheUpdate')
    .addToUi();
}

/**
 * Retrieve named Ranges for Portfolio, finds name forceRefresh and twiddles it to make everything update.
 * all sheets using Caching should create a boolean cell with a named reference of 'forceRefresh'.
 * This concept is used as a parameter to most caching functions to allow the user to refresh caches when
 * thing go stale or awry.
 */
function forceCacheUpdate() {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (let i = 0; i < namedRanges.length; i++) {
    const rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == "forceRefresh") {
      namedRanges[i].getRange().setValue(true);
      SpreadsheetApp.flush();
      namedRanges[i].getRange().setValue(false);
    }
  }
}

// retrieve named Ranges for Portfolio, find reloadCount and twiddle it to make custom functions with this as a parameter reload.
function forceCustomFunctionReload() {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (let i = 0; i < namedRanges.length; i++) {
    const rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == "reloadCount") {
      const counter = namedRanges[i].getRange().getValue();
      Logger.log('reload counter = ' + counter);
      namedRanges[i].getRange().setValue(counter + 1);
    }
  }
}