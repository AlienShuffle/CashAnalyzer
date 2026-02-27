import dynamicSort from '../lib/dynamicSort.mjs';
import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';

const ticker = (process.argv[2] && process.argv[2].length > 1) ? process.argv[2] : '';
if (ticker == '') throw 'missing argv[2] ticker!';

// read HTML from stdin - expects BondBloxx ticker table HTML
const htmlString = readFileSync(0, 'utf8');
const root = parse(htmlString);

// Extract the first table (ticker-table)
const divsTable = root.querySelector('#performance > div.first_sec > div > div > div.right_sec > div.dividends-band > table');
if (!divsTable) {
    console.error('Error: Could not find dividend table');
    process.exit(1);
}

// Get all rows from tbody
const tbody = divsTable.querySelector('tbody');
if (!tbody) {
    console.error('Error: Could not find tbody in table');
    process.exit(1);
}

// Parse all data rows (skip category headers which have colspan)
const rows = tbody.querySelectorAll('tr');
const results = [];

for (const row of rows) {
    // Skip category headers (they have colspan)
    if (row.querySelector('td[colspan]')) {
        continue;
    }

    const cells = row.querySelectorAll('td');
    if (cells.length < 4) continue;

    // Extract ticker (may contain a link)
    const exDividendDate = new Date(cells[0].innerText).toISOString().split("T")[0];
    const recordDate = new Date(cells[1].innerText).toISOString().split("T")[0];
    const payableDate = new Date(cells[2].innerText).toISOString().split("T")[0];
    const amount = cells[3].innerText * 1;

    results.push({
        ticker: ticker,
        exDividendDate: exDividendDate,
        recordDate: recordDate,
        payableDate: payableDate,
        ordinaryIncome: amount,
        totalDistribution: amount
    });
}
console.log(JSON.stringify(results.sort(dynamicSort('-recordDate'))));