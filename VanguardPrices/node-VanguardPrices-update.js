const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require("fs");

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

// read in from stdin, the Vanguard price history tool source data rows file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const rows = stdinBuffer.split('\n');
const timestamp = new Date();
let resp = [];
// go through each ticker report provided.
for (let i = 0; i < rows.length; i++) {
    const data = rows[i].split(':');
    const ticker = data[0];
    if (!ticker) continue;
    
    const dateObj = new Date(data[1]);
    const yield = (parseFloat(data[2]) / 100).toFixed(4) * 1;
    resp.push({
        "asOfDate": du.getISOString(dateObj),
        "price": 1,
        "sevenDayYield": yield,
        "source": 'Vanguard.com Price History',
        "ticker": ticker,
        "timestamp": timestamp,
    });
}
console.log(JSON.stringify(resp));