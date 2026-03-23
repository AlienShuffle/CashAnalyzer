export function parseCsvToMatrix(csvText) {
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