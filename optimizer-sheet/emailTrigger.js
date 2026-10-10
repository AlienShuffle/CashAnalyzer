// emailTrigger.gs
// v12 - updated to add row for XHLF
// v14b - genericized for larger fund list and ETFs.
// v15 - updated to use new fundMeta range to make fund name lookup more resilient.
// v16a - changed checkbox test to column T (new combined enablement and swap include value)
// v16b - changed sort to use a float version of ATY to get correct sort behavior.
// v16.2 - send swap emails on weekends.
// v17 - added more logging on 0% ATY abort, support the 1 or 2 day swap modes.

// Scope SpreadsheetApp Class to only the current document.
/**
 * @OnlyCurrentDoc
 */

/**
 * register a scheduled trigger for GoogleSheets that runs once a day at a specific hour.
 * @param string function name of function to be registered as a trigger.
 * @param integer hour hour of the day that the trigger should execute.
 */
function registerDailyTrigger(triggerFunction, hour) {
  // find out if the trigger has already been registered. 
  const triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() == triggerFunction) {
      alertMessageToast_(triggerFunction + ": Found an existing trigger, no action taken.");
      return;
    }
  }
  // No trigger found, create one for every day at hour requested.
  ScriptApp.newTrigger(triggerFunction)
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();
  alertMessageToast_(triggerFunction + ": installed trigger.");
}

/**
 * register a scheduled emailTrigger for GoogleSheets that runs once every x hours.
 * @param string function name of function to be registered as a trigger.
 * @param integer hour hour of the day that the trigger should execute.
 * I have defaulted the parameters to the local emailTrigger function every 4 hours.
 */
function registerEmailTrigger(triggerFunction = 'emailTrigger', hours = 4) {
  // find out if the trigger has already been registered. 
  const triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() == triggerFunction) {
      alertMessageToast_(triggerFunction + ": Found an existing trigger, deleting trigger.");
      ScriptApp.deleteTrigger(triggers[i]);
      // break out and head down to install new trigger.
      break;
    }
  }
  // No trigger found (or it was deleted), create one for every x hours as requested.
  ScriptApp.newTrigger(triggerFunction)
    .timeBased()
    .everyHours(hours)
    .create();

  alertMessageToast_(triggerFunction + ": installed trigger for every " + hours + " hours.");
}

/**
 * Intended as a scheduled trigger for GoogleSheets to run once a day to report swap recommendation.
 * emails a notification to the user defined in named range 'email
 */
function emailTrigger() {
  // verify that we have a usable/valid date in the SwapCalcs tab.
  function isValidDate(date) { return !(!date || date == '' || date <= 0 || date == '#N/A' || date == '#REF!' || date == '#ERROR!' || date == '#NAME?'); }
  function isValidNumber(x) { return !(x == '#N/A' || x == '#REF!' || x == '#ERROR!' || x == '#NAME?'); }

  // Try to get the sheet in "good shape" before looking around. We 
  // have been getting lots of #NAME? errors lately.
  SpreadsheetApp.flush();
  Utilities.sleep(1 * 1000);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ssName = ss.getName();
  const swapSheet = ss.getSheetByName("SwapCalcs");

  // get the target email address.
  const email = ssGetNamedRangeValue('email');
  // exit if no email address is defined.
  if (!email || email.includes('example.com')) {
    alertMessageToast_('no email address, trigger not completed.');
    return;
  }

  // get today's date for the trigger runtime.
  const date = new Date();

  // continue only if there is new reporting info
  var swapReportDate = ssGetNamedRangeValue('swapReportDate');
  // if date is not good, force reload to get a date.
  if (!isValidDate(swapReportDate)) {
    forceCustomFunctionReload();
    Utilities.sleep(1 * 1000);
    SpreadsheetApp.flush();
    alertMessageToast_('swapReportDate invalid. A forced function reload executed.');
    swapReportDate = ssGetNamedRangeValue('swapReportDate');
    // if date is not good, force cache update to get a date.
    if (!isValidDate(swapReportDate)) {
      forceCacheUpdate();
      Utilities.sleep(1 * 1000);
      SpreadsheetApp.flush();
      alertMessageToast_('swapReportDate invalid. A forced cache update executed.');
      swapReportDate = ssGetNamedRangeValue('swapReportDate');
      // if date is not good, sleep for 5 seconds, then flush.
      if (!isValidDate(swapReportDate)) {
        Utilities.sleep(5 * 1000);
        SpreadsheetApp.flush();
        alertMessageToast_('swapReportDate invalid. A 5 second sleep executed.');
        swapReportDate = ssGetNamedRangeValue('swapReportDate');
      }
    }
  }

  if (!isValidDate(swapReportDate)) {
    MailApp.sendEmail(email, 'Swap trigger failed',
      'The ' + ssName + ' swap email trigger failed.\n' +
      'The swapReportDate value was empty or invalid. (' + swapReportDate + ')\n' +
      'This most likely means that the update scripts failed or were delayed.\n\n' +
      'You can always open the sheet and force an update to get the latest status.\n\n' +
      'I will try again later!\n');
    alertMessageToast_('email failed, no swapReportDate available. A forced cache update is recommended.');
    return
  }
  Logger.log('swapReportDate = ' + swapReportDate);
  // get the last report date
  const lastReportDate = ssGetNamedRangeValue('triggerLastReportDate');
  Logger.log('lastReportDate = ' + lastReportDate);
  if (swapReportDate <= lastReportDate) {
    alertMessageToast_("report date not changed, no email sent.");
    return;
  }

  // prevent duplicate overnight emails on weekends due to Fidelity's pre-publishing one day rates on the weekend.
  const swapReportDayOfWeek = swapReportDate.getDay();
  if (swapReportDayOfWeek == 0 || swapReportDayOfWeek == 6) {
    alertMessageToast_("latest reported yield data from SAT or SUN, no email sent unless a swap occured.");
  }

  // Get email Frequency configuration from user.
  const emailFrequency = ssGetNamedRangeValue('emailFrequency');
  Logger.log('emailFrequency = ' + emailFrequency);
  const emailSwapOnly = emailFrequency == 'Swap Only' || swapReportDayOfWeek == 0 || swapReportDayOfWeek == 6;
  Logger.log('emailSwapOnly = ' + emailSwapOnly);

  // if a time based email configuration, collect dates to test if enough time has elapsed later.
  //Logger.log('Number(emailFrequency) = \'' + Number(emailFrequency) + '\'');
  const emailFrequencyDays = (isNaN(emailFrequency)) ? 90 : Number(emailFrequency);
  Logger.log('emailFrequencyDays = ' + emailFrequencyDays);
  const lastEmailAge = Math.abs((date - lastReportDate) / (24 * 60 * 60 * 1000));
  Logger.log('lastEmailAge = ' + lastEmailAge);

  /** Begin Swap calculations Section **/

  const swapDays = ssGetNamedRangeValue('swapDays');
  Logger.log(`swapDays =  ${swapDays}`);
  const swapStatusCell = (swapDays == 1) ? 'B2' : 'C2';

  // Was a swap triggered?
  let swapStatus = swapSheet.getRange(swapStatusCell).getValue();
  if (!isValidNumber(swapStatus)) {
    alertMessageToast_('swapStatus invalid. A forced function reload executing.');
    forceCustomFunctionReload();
    Utilities.sleep(1 * 1000);
    SpreadsheetApp.flush();
    swapStatus = swapSheet.getRange(swapStatusCell).getValue();
    // if date is not good, force cache update to get a date.
    if (!isValidNumber(swapStatus)) {
      alertMessageToast_('swapStatus invalid. A forced cache update executing.');
      forceCacheUpdate();
      Utilities.sleep(1 * 1000);
      SpreadsheetApp.flush();
      swapStatus = swapSheet.getRange(swapStatusCell).getValue();
      // if date is not good, sleep for 5 seconds, then flush.
      if (!isValidNumber(swapStatus)) {
        alertMessageToast_('swapStatus invalid. A 5 second sleep executing.');
        Utilities.sleep(5 * 1000);
        SpreadsheetApp.flush();
        swapStatus = swapSheet.getRange(swapStatusCell).getValue();
      }
    }
  }
  if (!isValidNumber(swapStatus)) {
    MailApp.sendEmail(email, 'Swap trigger failed',
      'The ' + ssName + ' swap email trigger failed.\n' +
      'The swapStatus value was empty or invalid. (' + swapStatus + ')\n' +
      'This most likely means that the update scripts failed to complete or were delayed.\n\n' +
      'You can always open the sheet and force an update to get the latest status.\n\n' +
      'I will try again later!\n');
    alertMessageToast_('email failed, no swapStatus available. A forced cache update is recommended.');
    return
  }
  Logger.log('swapStatus = ' + swapStatus);

  const swapBestToday = swapSheet.getRange('B3').getValue();
  const swapBestYesterday = swapSheet.getRange('C3').getValue();
  const swapHighestToday = swapSheet.getRange('B4').getValue();
  const swapHighestYesterday = swapSheet.getRange('C4').getValue();

  // test if we are on first day of a swap process.
  const highestFundText = (swapDays == 2 && swapBestToday == swapHighestToday) ?
    '' :
    '\n\n' + swapHighestToday + ' moved into first today, if it stays a second day, a swap will be recommended.';

  // bail if no swap and configured to send only on swap days.
  // only if any swap occured.
  if (emailSwapOnly && !swapStatus && highestFundText == '') {
    alertMessageToast_("No swaps, exiting today.");
    return;
  }
  // exit if their is no swap, and today is before next message date. 
  if (!swapStatus && highestFundText == '' && lastEmailAge < emailFrequencyDays) {
    alertMessageToast_("Too soon since last email sent, no email sent.");
    return;
  }

  // get table of fund tickers and names from MySummary tab.
  const summary = ss.getRangeByName("fundMeta").getValues();

  function getYieldString(row, col) {
    return Number(swapSheet.getRange(row, col).getValue() * 1).toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 2 });
  }
  function getFundName(fundTicker) {
    const sevenDay = fundTicker.indexOf(' 7-day MA');
    let shortTicker = (sevenDay > 0) ? fundTicker.substring(0, sevenDay) : fundTicker;
    const thirtyDay = fundTicker.indexOf(' 30-day MA');
    shortTicker = (thirtyDay > 0) ? shortTicker.substring(0, thirtyDay) : shortTicker;
    for (let i = 0; i < summary.length; ++i) {
      // return fund name for matching ticker
      if (summary[i][0] == shortTicker) {
        return summary[i][3];
      }
    }
    return "";
  }

  let yieldList = [];
  const lastFundRow = swapSheet.getLastRow() - 3; // last 3 rows are comments.
  for (let row = 5; row < lastFundRow; row++) {

    // column S is the enablement status, Column A is the include checkbox, and for final result.
    const checkbox = swapSheet.getRange(row, 19).getValue();
    if (!checkbox) continue;

    const swapFund = swapSheet.getRange(row, 1).getValue();
    console.log(`row(${row}): ATY=${swapSheet.getRange(row,12).getValue()}`);
    const swapFundATYFloat = Number(swapSheet.getRange(row, 12).getValue() * 1);
    const swapFundATYString = getYieldString(row, 12);
    const swapFundSECString = getYieldString(row, 10);
    const swapFundName = getFundName(swapFund);
    if (swapFundATYString == '0.00%') {
      Logger.log(`${swapFund} reported 0% ATY, aborting script. Data is not fully updated.`);
      return;
    }
    yieldList.push({
      swapFund: swapFund,
      swapFundATYFloat: swapFundATYFloat,
      swapFundATYString: swapFundATYString,
      swapFundSECString: swapFundSECString,
      swapFundName: swapFundName,
    });
    Logger.log(swapFundATYString + ' / ' + swapFundSECString + ' - ' + swapFund + ' (' + swapFundName + ')');
  }

  yieldList.sort(dynamicSort("-swapFundATYFloat", "swapFund"));
  let swapReportString = '';
  for (let i = 0; i < yieldList.length; i++)
    swapReportString += '\n' + yieldList[i].swapFundATYString + ' / ' + yieldList[i].swapFundSECString +
      ' - ' + yieldList[i].swapFund + (yieldList[i].swapFundName ? ' (' + yieldList[i].swapFundName + ')' : '');

  const emailBody = (swapDays == 2) ?
    'Best Today is ' + swapBestToday +
    ', Best Yesterday was ' + swapBestYesterday + highestFundText +
    '\n\nAfter Tax Yields / SEC Yields - Fund' + swapReportString
    :
    'Highest Today is ' + swapHighestToday +
    ', Highest Yesterday was ' + swapHighestYesterday +
    '\n\nAfter Tax Yields / SEC Yields - Fund' + swapReportString;

  // format email message.
  const subject = ssName + ((swapStatus) ? ' - Swap Triggered Today (' : ' - No Swap Triggered (')
    + swapReportDate.toDateString() + ')';
  Logger.log(subject);

  function dateRetrieveMMDDYYYYfromDate(date) {
    if (!date) return "";
    return (date.getMonth() + 1).toString() + '/' +
      date.getDate().toString() + '/' +
      date.getFullYear().toString();
  }

  const body = '\n\n** All Funds Optimizer - ' + dateRetrieveMMDDYYYYfromDate(swapReportDate) + '  **\n\n' + emailBody +
    '\n\nSwap Days: ' + swapDays +
    '\nReport Date: ' + swapReportDate.toDateString() +
    '\nTrigger Time: ' + date +
    '\n\nResidence: ' + ssGetNamedRangeValue('State') +
    '\nFed = ' + (ssGetNamedRangeValue('FederalRate') * 100).toFixed(2) + '%' +
    '\nState = ' + (ssGetNamedRangeValue('StateRate') * 100).toFixed(2) + '%' +
    '\nSALT itemize = ' + ssGetNamedRangeValue('deductSALT') +
    '\nNIIT = ' + (ssGetNamedRangeValue('NIIT_StateDed') * 100).toFixed(2) + '%' +
    '\n\nSheets Workbook: ' + ssName;
  Logger.log(`Subject: ${subject}\n${body}`);

  // send the email message.
  MailApp.sendEmail(email, subject, body);
  alertMessageToast_('Swap email was sent to: ' + email);

  // record last trigger run for user verification and to avoid repeated emails.
  ssSetNamedRangeValue('triggerLastExecution', date);
  ssSetNamedRangeValue('triggerLastReportDate', swapReportDate);
}