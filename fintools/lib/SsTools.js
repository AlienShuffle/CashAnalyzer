// ssTools.gs - this is a set of generic Google Sheets functions that are useful to interact with the spreadsheet.
// v15 - 4/13/23 - used in version 9 of MM Optimizer.
// v25 - added trackRangeUses function.
// v50 baseline.

/**
 * Returns the active sheet's name, not necessarily the sheet containing a formula.
 * Renaming or selecting a sheet is not a formula dependency; re-enter the formula to refresh.
 * Example: =ssGetSheetName()
 * @return {string} Active sheet name.
 * @customfunction
 */
function ssGetSheetName() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
}

/**
 * Returns the top-left cell value of a named range. Throws if the range is not found.
 * Prefer direct named-range references in formulas so Sheets tracks dependencies.
 * Example (script): ssGetNamedRangeValue("TitleRange")
 * @param {string} namedRange Name, matched after any sheet-name prefix.
 * @return {string|number|boolean|Date} Top-left cell value.
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
  throw new Error('Named range not found: ' + namedRange);
}

/**
 * Sets a named range's cell value(s). Script/menu use only; not a worksheet custom function.
 * Throws if the range is not found. Example (script): ssSetNamedRangeValue("TitleRange", "Title")
 * @param {string} namedRange Name, matched after any sheet-name prefix.
 * @param {string|number|boolean|Date} value Value applied to the range.
 * @return {string} Empty string on success.
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
  throw new Error('Named range not found: ' + namedRange);
}

/**
 * Finds exact named-range tokens in formulas in a sheet's used range.
 * Ignores quoted strings/sheet names, function names, and longer identifiers.
 * This is lexical matching, not a formula parser; INDIRECT strings are not references.
 * Example: =ssTrackRangeUses("Sheet1", "MyRange")
 * @param {string} sheetName Sheet to search.
 * @param {string} namedRange Named-range token to match.
 * @return {Array<Array<string>>|string} A1 references in row order, one per row; "" if none.
 * @customfunction
 */
function ssTrackRangeUses(sheetName, namedRange) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw "invalid sheet name";
  if (typeof namedRange !== 'string' || !namedRange.trim()) throw new Error('Named range is required');

  function ssIndexToColumnLetter_(index) {
    let column = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
      column = String.fromCharCode(65 + (n - 1) % 26) + column;
    }
    return column;
  }

  let out = [];
  const range = sheet.getDataRange();
  const formulas = range.getFormulas();
  const escaped = namedRange.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reference = new RegExp('(^|[^\\w.\\u0080-\\uFFFF])' + escaped +
    '(?![\\w.\\u0080-\\uFFFF]|\\s*[!(])', 'i');
  for (let row = 0; row < formulas.length; row++) {
    for (let cell = 0; cell < formulas[row].length; cell++) {
      const formula = formulas[row][cell].replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, ' ');
      if (reference.test(formula)) {
        out.push([ssIndexToColumnLetter_(range.getColumn() - 1 + cell) + (range.getRow() + row)]);
      }
    }
  }
  if (out.length) return out;
  return "";
}
