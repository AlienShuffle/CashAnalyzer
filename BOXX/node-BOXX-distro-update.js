import { readFileSync } from "fs";
import dynamicSort from '../lib/dynamicSort.mjs';

function parseCsvToMatrix(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    const next = csvText[i + 1];

    if (insideQuotes) {
      if (c === '"' && next === '"') {
        // Escaped double-quote
        value += '"';
        i++;
      } else if (c === '"') {
        // Closing quote
        insideQuotes = false;
      } else {
        value += c;
      }
    } else {
      if (c === '"') {
        insideQuotes = true;
      } else if (c === ',') {
        row.push(value);
        value = "";
      } else if (c === '\n') {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else if (c === '\r') {
        // ignore CR in CRLF files
      } else {
        value += c;
      }
    }
  }

  // Push last value / row
  row.push(value);
  rows.push(row);

  return rows;
}

const ticker = 'BOXX';
const contentText = readFileSync(0, 'utf-8');
const csvMatrix = parseCsvToMatrix(contentText);

const outputHeader = ["recordDate", "exDividendDate", "payableDate", "totalDistribution", "ordinaryIncome", "stcg", "ltcg", "returnOfCapital"];
// "Ex Date","Record Date","Payable Date","Income","Short Term Capital Gain","Long Term Capital Gain","Total Capital Gain","Total Distribution"
const outputSourceCells = [1, 0, 2, 7, 4, 5, 6, 3]; // maps the input columns to the output columns, in order of output columns. 0-based index for input columns.

let results = [];
const timestamp = new Date();
for (let i = 1; i < csvMatrix.length; i++) {
  const row = csvMatrix[i];

  let rowData = {
    ticker: ticker,
    timestamp: timestamp
  };
  // use the outputSourceCells to map the input columns to the output columns, in order of output columns. 0-based index for input columns.
  for (let j = 0; j < outputSourceCells.length; j++) {
    const col = outputSourceCells[j];
    const outputHeaderName = outputHeader[j];
    if (col === 1 || col === 0 || col === 2) {
      // date fields - convert to ISO string
      rowData[outputHeaderName] = row[col];
    } else {
      rowData[outputHeaderName] = (row[col] * 1).toFixed(6) * 1; // convert to number with 6 decimal places
    }
  }
  results.push(rowData);
}
console.log(JSON.stringify(results.sort(dynamicSort('-recordDate'))));