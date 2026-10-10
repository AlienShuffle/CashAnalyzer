// ssTools.gs - this is a set of generic Google Sheets functions that are useful to interact with the spreadsheet.
// this should eventually get moved into fintools.
// v15 - 4/13/23 - used in version 9 of MM Optimizer.
// v25 - added trackRangeUses function.
// v50 baseline.

/**
 * Retrieves the current sheet name from the Google Sheets App. This cannot be done in a
 * direct call in a cell, thus this small function. Note, this is a VERY expensive call. do not use lightly.
 *
 * @return string
 * @customfunction
 */
function ssGetSheetName() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
}

/**
 * Search the Named Ranges defined the spread sheet and return the value of the one requested.
 * For Apps Script use only, not needed in a sheet!  Returns string value of the Named Range provided.
 * Returns string value value of the Named Range provided.
 * 
 * @param {string} namedRange name of a range in the spreadsheet (only compares on the part after the ! if a sheetname is referenced).
 * 
 * @customfunction
 */
function ssGetNamedRangeValue(namedRange) {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (let i = 0; i < namedRanges.length; i++) {
    let rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == namedRange) {
      return namedRanges[i].getRange().getValue();
    }
  }
  return "";
}

/**
 * Search the Named Ranges defined the spread sheet and set the value of the one requested.
 * For Apps Script use only, not needed in a sheet! 
 * 
 * @param {"TitleRange"} namedRange name of a range in the spreadsheet (only compares on the part after the ! if a sheetname is referenced).
 * @param {string} value value to set.
 * @customfunction
 */
function ssSetNamedRangeValue(namedRange, value) {
  const namedRanges = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (let i = 0; i < namedRanges.length; i++) {
    let rangeName = namedRanges[i].getName();
    rangeName = rangeName.substring(rangeName.indexOf('!') + 1);
    if (rangeName == namedRange) {
      namedRanges[i].getRange().setValue(value);
      return "";
    }
  }
  return "";
}

/**
 * Find all references to a specific namedRange in the supplied worksheet. 
 * 
 * @param {string} sheetName to search.
 * @param {string} namedRange namedRange defined in the spreadsheet.
 * @return [string] cellReference an array of cell references containing the namedRange.
 * @customfunction
 */
function ssTrackRangeUses(sheetName, namedRange) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw "invalid sheet name";

  function ssIndexToColumnLetter_(index) {
    var map = ["zero",
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
      "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
      "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM",
      "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ"];
    return map[index + 1];
  }

  let out = [];
  const rows = sheet.getMaxRows();
  const columns = sheet.getMaxColumns();
  for (let row = 1; row <= rows; row++) {
    const rowData = sheet.getRange(row, 1, 1, columns).getFormulas();
    for (let cell = 0; cell < rowData[0].length; cell++) {
      let index = rowData[0][cell].indexOf(namedRange);
      if (index >= 0) {
        out.push([ssIndexToColumnLetter_(cell) + row.toString()]);
      }
    }
  }
  if (out.length) return out;
  return "";
}
