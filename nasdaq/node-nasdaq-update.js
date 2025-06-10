const { time, timeStamp } = require('console');
// Work on POSIX and Windows
const fs = require("fs");
const {
    duGetDateFromYYYYMMDD,
    duDateEqualTo,
    duGetISOString,
    getDateDelta
} = require('../lib/dateUtils.mjs');

function safeObjectRef(obj) {
    if (typeof obj === 'undefined') return '';
    return obj;
}

function duIsDateAHoliday(date) {
    // This needs to be updated every few years.
    // see this page for dates: https://www.marketbeat.com/bond-market-holidays/
    const holidays = [
        '2025-01-01',
        '2025-01-20',
        '2025-02-17',
        '2025-04-18',
        '2025-05-26',
        '2025-06-19',
        '2025-07-04',
        '2025-09-01',
        '2025-10-13',
        '2025-11-11',
        '2025-11-27',
        '2025-12-25',
        '2026-01-01',
        '2026-01-19',
        '2026-02-16',
        '2026-04-03',
        '2026-05-25',
        '2026-06-19',
        '2026-07-03',
        '2026-09-07',
        '2026-10-12',
        '2026-11-11',
        '2026-11-26',
        '2026-12-25',
        '2027-01-01',
        '2027-01-18',
        '2027-02-15',
        '2027-03-26',
        '2027-05-31',
        '2027-06-18',
        '2027-07-05',
        '2027-09-06',
        '2027-10-11',
        '2027-11-11',
        '2027-11-25',
        '2027-12-24',
        '2028-01-03',
        '2028-01-17',
        '2028-02-21',
        '2028-04-14',
        '2028-05-29',
        '2028-06-19',
        '2028-07-04',
        '2028-09-04',
        '2028-10-09',
        '2028-11-10',
        '2028-11-23',
        '2028-12-25',
        '2029-01-01',
        '2029-01-15',
        '2029-02-19',
        '2029-03-30',
        '2029-05-28',
        '2029-06-19',
        '2029-07-04',
        '2029-09-03',
        '2029-10-08',
        '2029-11-12',
        '2029-11-22',
        '2029-12-25',
    ];
    for (let i in holidays) {
        const h = duGetDateFromYYYYMMDD(holidays[i]);
        if (duDateEqualTo(date, h)) {
            return true;
        }
    }
    return false;
}
function duTradeDateOffset(date) {
    switch (date.getDay()) {
        case 0:
            return -2; // Sunday -> Friday
        case 1:
            return -3; // Monday -> Friday
        case 6:
            return -1; // Saturday -> Monday
        default:
            return 0;
    }
}
function findPreviousTradeDate(origDate) {
    // get previous day of week that valid trading day.
    const offset = duTradeDateOffset(getDateDelta(origDate, -1));
    const adjDate = getDateDelta(origDate, offset - 1);
    // if that day was a holiday, look back to previous valid trading day.
    if (duIsDateAHoliday(adjDate)) {
        const offset = duTradeDateOffset(getDateDelta(adjDate, -1));
        return getDateDelta(adjDate, offset - 1);
    } else {
        return adjDate;
    }
}
// Let's get the last trading date based on current date/time.
const timestamp = new Date;
const asOfDateStr = duGetISOString(findPreviousTradeDate(timestamp));
// read in from stdin, the NASDAQ mutual fund yield API data.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
let resp = [];
// go through each ticker report provided.
for (let i = 0; i < json.length; i++) {
    const fund = json[i];
    const ticker = fund.ticker;
    if (!ticker) continue;
    if (
        !safeObjectRef(fund.yields.data) ||
        !safeObjectRef(fund.yields.data.summaryData) ||
        !safeObjectRef(fund.yields.data.summaryData.SevenDayYield) ||
        !safeObjectRef(fund.yields.data.summaryData.SevenDayYield.value)
    ) {
        console.error(`${ticker} yield is missing.`);
        continue;
    }
    const yieldStr = fund.yields.data.summaryData.SevenDayYield.value;
    if (yieldStr == 'N/A') {
        console.error(`${ticker} yield is n/a`);
        continue;
    }
    resp.push({
        "asOfDate": asOfDateStr,
        "price": 1,
        "sevenDayYield": parseFloat(yieldStr / 100).toFixed(4) * 1,
        "source": 'NASDAQ',
        "ticker": ticker,
        "timestamp": timestamp,
    });
}
console.log(JSON.stringify(resp));