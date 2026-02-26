import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';

// read HTML from stdin - expects BondBloxx ticker table HTML
const htmlString = readFileSync(0, 'utf8');
const root = parse(htmlString);

// Extract the first table (ticker-table)
const tickerTable = root.querySelector('table#ticker-table');
if (!tickerTable) {
    console.error('Error: Could not find table#ticker-table');
    process.exit(1);
}

// Get all rows from tbody
const tbody = tickerTable.querySelector('tbody');
if (!tbody) {
    console.error('Error: Could not find tbody in table');
    process.exit(1);
}

// Parse all data rows (skip category headers which have colspan)
const rows = tbody.querySelectorAll('tr');
const funds = [];

for (const row of rows) {
    // Skip category headers (they have colspan)
    if (row.querySelector('td[colspan]')) {
        continue;
    }

    const cells = row.querySelectorAll('td');
    if (cells.length < 4) continue;

    // Extract ticker (may contain a link)
    const tickerCell = cells[0];
    const tickerLink = tickerCell.querySelector('a');
    const ticker = tickerLink ? tickerLink.text.trim() : tickerCell.text.trim();
    const url = tickerLink ? tickerLink.getAttribute('href') : null;

    // Extract fund name
    const fundName = cells[1].text.trim();

    // Extract expense ratio
    const expenseRatio = (cells[2].text.replace("%","").trim()/100).toFixed(5)*1;

    // Extract 30-day SEC yield
    const secYield = (cells[3].text.replace("%","").trim()/100).toFixed(5)*1;

    funds.push({
        ticker: ticker,
        accountType: fundName,
        url: url,
        expenseRatio: expenseRatio,
        thirtyDayYield: secYield
    });
}

console.log(JSON.stringify(funds, null, 2));