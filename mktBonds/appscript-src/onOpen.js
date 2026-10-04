// onOpen.gs - standard menu setup, with key regular functions that are triggered.


// Menu for testing your script - creates a menu item on the Google Sheets menubar for manual execution.
function onOpen() {
  setMenu();
}

// set the custom menu, but embed toggle status in the menu names.
function setMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('TIPS Controls')
    .addItem('Force Cache Update', 'forceUpdate')
    .addItem('Reload Custom Functions', 'forceCustomFunctionReload')
    .addItem('Force IMPORTDATA Update', 'forceReImportData')
    .addItem('Refresh Treasury', 'refreshTreasury')
    .addToUi();
}


// retrieve named Ranges for Portfolio, find forceRefresh and twiddle it to make everything update.
function forceUpdate() {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (let i = 0; i < namedRanges.length; i++) {
    let rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == 'forceRefresh') {
      namedRanges[i].getRange().setValue(true);
      SpreadsheetApp.flush();
      namedRanges[i].getRange().setValue(false);
    }
  }
}

// retrieve named Ranges for Portfolio, find reloadCount and twiddle it to make custom functions with this as a parameter reload.
function forceCustomFunctionReload() {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (var i = 0; i < namedRanges.length; i++) {
    var rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == 'reloadCount') {
      const counter = namedRanges[i].getRange().getValue();
      Logger.log('reload counter = ' + counter);
      namedRanges[i].getRange().setValue(counter + 1);
    }
  }
}

function forceReImportData() {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (var i = 0; i < namedRanges.length; i++) {
    var rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == "reimportCount") {
      const counter = namedRanges[i].getRange().getValue();
      Logger.log('re-import counter = ' + counter);
      namedRanges[i].getRange().setValue(counter + 1);
      break;
    }
  }
  SpreadsheetApp.flush();
}

// retrieve named Ranges for Portfolio, find forceRefresh and twiddle it to make everything update.
function refreshTreasury() {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (let i = 0; i < namedRanges.length; i++) {
    let rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == 'forceRefreshTreasury') {
      namedRanges[i].getRange().setValue(true);
      SpreadsheetApp.flush();
      namedRanges[i].getRange().setValue(false);
    }
  }
}