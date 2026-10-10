// ssTools.gs - this is a set of generic Google Sheets functions that are useful to interact with the spreadsheet.
// v149 - re-baseline documentation.
// v152 - verified

/**
 * Retrieves the current sheet name from the Google Sheets App. This cannot be done in a
 * direct call in a cell, thus this small function. Note, this is a VERY expensive call. Do not use lightly.
 * Returns string value.
 * 
 * @customfunction
 */
function ssGetSheetName() {
  return fintools.ssGetSheetName();
}

/**
 * Search the Named Ranges defined the spread sheet and return the value of the one requested.
 * For Apps Script use only, not needed in a sheet! 
 * Returns string value value of the Named Range provided.
 * 
 * @param {string} namedRange name of a range in the spreadsheet (only compares on the part after the ! if a sheetname is referenced).
 * @customfunction
 */
function ssGetNamedRangeValue(namedRange) {
  return fintools.ssGetNamedRangeValue(namedRange);
}

/**
 * Search the Named Ranges defined the spread sheet and set the value of the one requested.
 * For Apps Script use only, not needed in a sheet! 
 * 
 * @param {string} namedRange name of a range in the spreadsheet (only compares on the part after the ! if a sheetname is referenced).
 * @param {string} value value to set.
 * @customfunction
 */
function ssSetNamedRangeValue(namedRange, value) {
  return fintools.ssSetNamedRangeValue(namedRange, value);
}

/**
 * Find all references to a specific namedRange in the supplied worksheet. 
 * Returns [string] cellReference an array of cell references containing the namedRange.
 * 
 * @param {string} sheetName to search.
 * @param {string} namedRange namedRange defined in the spreadsheet.
 * @customfunction
 */
function ssTrackRangeUses(sheetName, namedRange) {
  return fintools.ssTrackRangeUses(sheetName, namedRange);
}