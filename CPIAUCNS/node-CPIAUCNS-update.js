const series = "CPIAUCNS";
const startDate = "1913-01-01";
const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${startDate}&coed=9999-12-31`);
const csvText = await response.text();
const monthsText = csvText.split("\n"); 0

// seed with the missing month due to 2025 Govt shutdown, then loop through the rest of the months and build the response for each month.
let months = [{
    month: "2025-10-01",
    CPI: 325.604
}];
for (let i = 1; i < monthsText.length; i++) {
    const row = monthsText[i].split(",");
    const month = row[0];
    const CPI = row[1] * 1;
    if (isNaN(CPI) || CPI === 0) continue; // skip rows with missing CPI values
    months.push({
        month: month,
        CPI: CPI,
    });
}
months.sort((a, b) => new Date(a.month) - new Date(b.month)); // sort by month to get shutdown month in correct order

console.log(`date,${series}`);
for (let i = 0; i < months.length; i++) {
    const r = months[i];
    console.log(`${r.month},${r.CPI.toFixed(3)}`);
}