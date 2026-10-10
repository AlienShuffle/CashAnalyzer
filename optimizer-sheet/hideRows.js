// hideRows.gs
// v17 - updated to revised ETF Bestnow new Structure...

//  The hides/shows rows in the MySummary tab to display if active, hide if disabled.
//  Uses the values in column I to set that, they are driven by the configuration lower in the sheet.
function hideRows() {
  // actually process the rows.
  function processRows(sheet, range) {
    const values = range.getValues();
    const startRow = range.getRow();
    //Logger.log(`startRow=${startRow}`);
    for (let i = 0; i < values.length; i++) {
      if (values[i] == "true") {
        //Logger.log(`show:${i}:${values[i]}`);
        sheet.showRows(startRow + i);
      } else {
        //Logger.log(`hide:${i}:${values[i]}`);
        sheet.hideRows(startRow + i);
      }
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  processRows(
    ss.getSheetByName('MySummary'),
    ss.getRangeByName("toggleRange")
  );
  processRows(
    ss.getSheetByName('A BestNow'),
    ss.getRange("A BestNow!V8:V15")
  );
  processRows(
    ss.getSheetByName('B BestNow'),
    ss.getRange("B BestNow!V8:V15")
  );
  processRows(
    ss.getSheetByName('ETF BestNow'),
    ss.getRange("ETF BestNow!R8:R15")
  );
}