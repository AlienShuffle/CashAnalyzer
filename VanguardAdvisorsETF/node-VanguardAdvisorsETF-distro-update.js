import { readFileSync } from "fs";
import dynamicSort from '../lib/dynamicSort.mjs';
import { parseCsvToMatrix } from '../lib/parseCsv.mjs';

function safeNumberRef(obj) { return (typeof obj === 'undefined') ? 0 : obj; }

const ticker = (process.argv && process.argv[2]) ? process.argv[2] : '';
if (!ticker) {
  console.error("Ticker argument is required");
  process.exit(1);
}

// Type codes used by the Vanguard distributions API, mapped to the labels the CSV export uses.
const distributionTypeNames = {
  INC: "Income",
  CGLT: "Long-term Capital Gain",
  CGST: "Short-term Capital Gain",
  ROC: "Return of Capital"
};

// Accepts "MM/DD/YYYY" from the CSV export and "YYYY-MM-DD" from the API. ISO values pass
// through untouched so they cannot be shifted a day by a timezone round-trip.
function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

function normalizeAmount(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? "").replace(/[$,]/g, "").trim();
  if (!text) return NaN;
  return Number(text);
}

function readJsonRecords(contentText) {
  return JSON.parse(contentText).map(entry => ({
    type: distributionTypeNames[entry.typeCode] || entry.typeCode,
    amount: normalizeAmount(entry.amount),
    payableDate: normalizeDate(entry.payableDate),
    recordDate: normalizeDate(entry.recordDate),
    exDividendDate: normalizeDate(entry.exDividendDate)
  }));
}

function readCsvRecords(contentText) {
  const csvMatrix = parseCsvToMatrix(contentText);
  const records = [];
  // Vanguard distributions data has a header in the first five rows, so start at row 5 (0-based index)
  for (let i = 5; i < csvMatrix.length; i++) {
    if (csvMatrix[i].length < 2) {
      // skip empty or malformed rows at the end of file.
      break;
    }
    const row = csvMatrix[i];
    records.push({
      type: row[0],
      amount: normalizeAmount(row[1]),
      payableDate: normalizeDate(row[2]),
      recordDate: normalizeDate(row[3]),
      exDividendDate: normalizeDate(row[4])
    });
  }
  return records;
}

const contentText = readFileSync(0, 'utf-8');
if (!contentText.trim()) {
  console.error(`No distribution content supplied for ticker '${ticker}'`);
  process.exit(1);
}

// The collector writes JSON when it can capture the fund API and CSV when it falls back to
// the export button, so accept whichever form arrives on stdin.
const looksLikeJson = contentText.replace(/^\uFEFF/, "").trimStart().startsWith("[");
let records;
try {
  records = looksLikeJson ? readJsonRecords(contentText) : readCsvRecords(contentText);
} catch (err) {
  console.error(`Unable to parse distribution content for ticker '${ticker}': ${err.message}`);
  process.exit(1);
}

let distros = {};
for (const record of records) {
  const { type, amount, exDividendDate, payableDate, recordDate } = record;
  if (!exDividendDate || Number.isNaN(amount)) {
    console.error(`Skipping malformed ${ticker} distribution row: ${JSON.stringify(record)}`);
    continue;
  }
  if (!distros[exDividendDate]) {
    distros[exDividendDate] = {
      payableDate: payableDate,
      recordDate: recordDate
    };
  } else {
    distros[exDividendDate].payableDate = payableDate;
    distros[exDividendDate].recordDate = recordDate;
  }
  switch (type) {
    case "Income":
      distros[exDividendDate].ordinaryIncome = amount;
      break;
    case "Long-term Capital Gain":
      distros[exDividendDate].ltcg = amount;
      break;
    case "Short-term Capital Gain":
      distros[exDividendDate].stcg = amount;
      break;
    case "Return of Capital":
      distros[exDividendDate].returnOfCapital = amount;
      break;
    default:
      console.error("Unknown distribution type: " + type);
      break
  }
}

let results = [];
const timestamp = new Date();
Object.keys(distros).forEach(key => {
  results.push({
    ticker: ticker,
    timestamp: timestamp,
    recordDate: distros[key].recordDate,
    exDividendDate: key,
    payableDate: distros[key].payableDate,
    totalDistribution: (
      safeNumberRef(distros[key].ordinaryIncome) +
      safeNumberRef(distros[key].stcg) +
      safeNumberRef(distros[key].ltcg) +
      safeNumberRef(distros[key].returnOfCapital)
    ).toFixed(6) * 1,
    ordinaryIncome: distros[key].ordinaryIncome,
    stcg: distros[key].stcg,
    ltcg: distros[key].ltcg,
    returnOfCapital: distros[key].returnOfCapital
  });
});

// Content that yields no distributions means the wrong file was captured. Fail loudly rather
// than emitting an empty array that would silently stall the history.
if (results.length === 0) {
  console.error(`No distributions parsed for ticker '${ticker}'; refusing to emit empty results.`);
  process.exit(1);
}

console.log(JSON.stringify(results.sort(dynamicSort('-recordDate'))));