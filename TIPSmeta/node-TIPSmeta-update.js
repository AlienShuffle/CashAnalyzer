import {
    roundTo,
    roundToFixed
} from "../lib/utils.mjs";

const response = await fetch(
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/tips_cpi_data_summary?fields=cusip,interest_rate,security_term,series,maturity_date,dated_date,ref_cpi_on_dated_date&sort=maturity_date&format=csv"
);
const csvText = await response.text();
const bondsText = csvText.split("\n"); 0

if (bondsText.length <= 10) {
    console.error("Error: Not enough data points retrieved. probaby intermittent issue.");
    process.exit(1);
}
console.log(bondsText[0]);
for (let i = 1; i < bondsText.length; i++) {
    const row = bondsText[i].split(",");
    if (row.length < 5) continue; // skip rows with missing values
    const rate = row[1].replace(/"/g, '') * 1;
    if (isNaN(rate) || rate === 0) continue; // skip rows with missing rate values
    row[1] = roundTo(rate / 100, 5);
    row[2] = row[2].replace(/-Year/g, '').replace(/"/g, '');
    if (row[2].includes(" 6-Month")) row[2] = roundTo(row[2].replace(" 6-Month", '').replace(/"/g, '') * 1 + .5, 1);
    row[6] = roundToFixed(row[6].replace(/"/g, '') * 1, 5, 6);
    console.log(row.join(","));
}
