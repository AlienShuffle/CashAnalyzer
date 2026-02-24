import { readFileSync } from "fs";
import dynamicSort from '../lib/dynamicSort.mjs';
import { parseCsvToMatrix } from '../lib/parseCsv.mjs';

function safeNumberRef(obj) { return (typeof obj === 'undefined') ? 0 : obj; }

const ticker = (process.argv && process.argv[2]) ? process.argv[2] : '';
if (!ticker) {
  console.error("Ticker argument is required");
  process.exit(1);
}

const contentText = readFileSync(0, 'utf-8');
const csvMatrix = parseCsvToMatrix(contentText);

let distros = [];
// Vanguard distributions data has a header in the first five rows, so start at row 5 (0-based index)
for (let i = 5; i < csvMatrix.length; i++) {
  if (csvMatrix[i].length < 2) {
    // skip empty or malformed rows at the end of file.
    break;
  }
  const row = csvMatrix[i];
  const amount = row[1].replace("$", "").replace(",", "") * 1;
  const exDividendDate = new Date(row[4]).toISOString().split("T")[0];
  const payableDate = new Date(row[2]).toISOString().split("T")[0];
  const recordDate = new Date(row[3]).toISOString().split("T")[0];
  if (!distros[exDividendDate]) {
    distros[exDividendDate] = {
      payableDate: payableDate,
      recordDate: recordDate
    };
  } else {
    distros[exDividendDate].payableDate = payableDate;
    distros[exDividendDate].recordDate = recordDate;
  }
  switch (row[0]) {
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
      console.error("Unknown distribution type: " + row[0]);
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
console.log(JSON.stringify(results.sort(dynamicSort('-recordDate'))));