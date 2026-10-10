/**
 * Inserts a new row below the selected row and copies formulas from the row above.
 * modified to insert an arbitrary # of rows calculated based on desired structure of the sheet (manual)
 * Also, takes formula from the row ABOVE the chosen row and copies from the selected row,
 * through all insert rows and one row past it.
 * 
 * This is not for casual use, but for the developer to grow sheets with a minimum of manual effort.
 * Again, VERY VERY DANGEROUS to the integrity of the workbook.
 * don't share as a @customfunction
 */
function insertRowAndCopyFormulas() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet(); // Gets the currently active spreadsheet.
  const sheet = spreadsheet.getActiveSheet(); // Gets the currently active sheet.

  // Get the selected row. If no specific cell/row is selected, the first row will be assumed.
  const activeCell = sheet.getActiveCell();
  const selectedRow = activeCell.getRow(); // Get the row number of the selected cell.

  // This is a manual set of values to calculate for the use at hand.
  const yearsOfRows = 3;
  const fixedHeaderRows = 2; // this actually header and footer rows that don't count to the daily rows needed.
  const origRows = sheet.getLastRow();
  const totalRowsNeeded = yearsOfRows * 366 + fixedHeaderRows;
  const numRowsToInsert = (totalRowsNeeded < origRows) ? 0 : totalRowsNeeded - origRows;
  Logger.log("numRowsToInsert=" + numRowsToInsert);
  //if (numRowsToInsert != 1) return numRowsToInsert;

  // Insert a new row below the selected row.
  sheet.insertRowsAfter(selectedRow, numRowsToInsert); // Insert 1 row after the selected row.

  // Get the range of the row containing the formulas to copy (the row above the new row).
  const sourceRange = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()); // Get the row above the new row.

  // Get the formulas from the source range.  Using getFormulasR1C1() preserves relative references.
  const sourceFormulas = sourceRange.getFormulasR1C1()[0]; // Get the formulas from the source row.

  // we walk each row inserted AND the next row and copy the formulas. this fixes formulas that 
  // may refer to the previous row that got separated in the insertion process.
  for (let row = 1; row <= (numRowsToInsert + 1); row++) {
    // Get the target range for the new row.
    const targetRow = selectedRow + row; // The new rows are sequentially below the selected row.

    // Copy the formulas from the source row to the new row.
    for (let i = 0; i < sourceFormulas.length; i++) {
      if (sourceFormulas[i] !== '') { // Only copy formulas if they exist in the source row.
        sheet.getRange(targetRow, i + 1).setFormulaR1C1(sourceFormulas[i]); // Set the formulas using R1C1 notation.
      }
    }
  }
  alertMessageToast_(`Rows inserted: ${numRowsToInsert}`);
}
