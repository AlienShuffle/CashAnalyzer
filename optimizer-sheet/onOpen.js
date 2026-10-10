// onOpen.gs
// v14 - rebaselined after cleanup and merger.
// v16.2 - update to update weekends daily, the emailTrigger will skip weekends if no swaps occur.

// Scope SpreadsheetApp Class to only the current document.
/**
 * @OnlyCurrentDoc
 */

// Menu for testing your script - creates a menu item on the Google Sheets menubar for manual execution.
function onOpen() {
  // set the menu up with google toggle status updated to correct value.
  const state = getNamedRangeValue("runGoogleQueries");
  setMenu(state);
  // run this for good measure upon opening each time.
  updateHistoryDate();
  //forceCustomFunctionReload();
}

// log a message to the screen if running from the spreadsheet, log it too.
function alertMessageToast_(msg) {
  Logger.log(msg);
  try {
    SpreadsheetApp.getActive().toast('', msg, 10);
    return;
  } catch {
    Logger.log('Running headless, toast failed.');
    return;
  }
}

function registerEmailTriggers() {
  // this will update the date parameter to yesterday, then flush to recalculate the sheet.
  // run it a 2AM every morning.
  Logger.log('setting updateHistoryDate Hour to 2');
  registerDailyTrigger('updateHistoryDate', 2);
  // this installs a trigger tht runs every 4 hours send email if new report data is avalialble.
  Logger.log('setting up emailTrigger');
  registerEmailTrigger();
}

// retrieve named Ranges for Portfolio, find forceRefresh and twiddle it to make everything update.
function forceCacheUpdate() {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (var i = 0; i < namedRanges.length; i++) {
    var rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == "forceRefresh") {
      namedRanges[i].getRange().setValue(true);
      SpreadsheetApp.flush();
      namedRanges[i].getRange().setValue(false);
      break;
    }
  }
}

// retrieve named Ranges for Portfolio, find reloadCount and twiddle it to make custom functions with this as a parameter reload.
function forceCustomFunctionReload() {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (var i = 0; i < namedRanges.length; i++) {
    var rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == "reloadCount") {
      const counter = namedRanges[i].getRange().getValue();
      Logger.log('reload counter = ' + counter);
      namedRanges[i].getRange().setValue(counter + 1);
      break;
    }
  }
  SpreadsheetApp.flush();
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

// This is a function that can set the End Date on the Optimize Study tab to the last normal trading day.
// It ignores bank holidays and closed Markets, but close enough.
function updateHistoryDate() {

  // always start with yesterday assuming most times the reports are not updated until late in the day.
  const newDate = new Date;

  // what day of the week was that date? 0 = Sun, 6 = SAT.
  const weekday = newDate.getDay();

  // set the date to a MON-FRI only.
  /** - disable weekend skip for now to test the daily updates on the weekends.
   * if (weekday == 0) {
    // SUN -> FRI
    newDate.setDate(newDate.getDate() - 2);
  } else if (weekday == 6) {
    // SAT -> FRI
    newDate.setDate(newDate.getDate() - 1);
  }
  */
  const oldDate = ssGetNamedRangeValue('EndDate');
  if (
    oldDate &&
    oldDate.getDate() == newDate.getDate() &&
    oldDate.getMonth() == newDate.getMonth() &&
    oldDate.getFullYear() == newDate.getFullYear()
  ) {
    alertMessageToast_('History Date unchanged ' + newDate.toLocaleDateString());
    return;
  }
  ssSetNamedRangeValue('EndDate', newDate.toLocaleDateString());
  alertMessageToast_('History Date set to ' + newDate.toLocaleDateString());
  SpreadsheetApp.flush();
}

//
// function to setup the Optimizer Actions menu with google toggle status displayed.
//
function setMenu(googleToggle) {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Optimizer Actions')
    .addItem('Show/Hide Active Fund Rows', 'hideRows')
    .addItem('Force Cache Update', 'forceCacheUpdate')
    .addItem('Reload Custom Functions', 'forceCustomFunctionReload')
    .addItem('Force IMPORTDATA Update', 'forceReImportData')
    .addItem('Update History Date', 'updateHistoryDate')
    .addItem(((googleToggle) ? 'Disable' : 'Enable') + ' googlefinance() Queries', 'toggleGoogleQueries')
    .addItem('Install email Triggers', 'registerEmailTriggers')
    .addItem('Run swapping email', 'emailTrigger')
    //.addItem('insert rows (DO NOT USE!)','insertRowAndCopyFormulas')
    .addToUi();
  alertMessageToast_(`Google Queries are ${(googleToggle) ? 'Enabled' : 'Disabled'}`);
}

// toggle paramRunGFQueries state.
function toggleGoogleQueries() {
  const state = toggleCheckBox("runGoogleQueries");
  setMenu(state);
}
// retrieve named Ranges for Portfolio, find nameRange and toggle state (true/false).
function toggleCheckBox(namedRange) {

  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (var i = 0; i < namedRanges.length; i++) {
    let rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == namedRange) {
      const state = !namedRanges[i].getRange().getValue();
      namedRanges[i].getRange().setValue(state);
      return state;
    }
  }
}

// retrieves current value of a named range (assumes single cell).
function getNamedRangeValue(namedRange) {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (var i = 0; i < namedRanges.length; i++) {
    let rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == namedRange) {
      const value = namedRanges[i].getRange().getValue();
      return value;
    }
  }
}