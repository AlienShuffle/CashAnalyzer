
const fs = require('fs');
const process = require('process');

const ticker = (typeof process.argv[2] === 'undefined') ? 'USFR' : process.argv[2];

// read in from stdin, the CIKD list.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);

function parseIt(item) {
    return {
        "asOfDate": item.asOfDate,
        "price": item.nav,
        "thirtyDayYield": item.secYield,
        "source": "Wisdomtree yields",
        "ticker": ticker,
        "timestamp": item.timestamp,
    };
}
let resp = [];
if (Array.isArray(json)) {
    for (let i = 0; i < json.length; i++) { resp.push(parseIt(json[i])); }
} else {
    resp.push(parseIt(json));;
}
console.log(JSON.stringify(resp));