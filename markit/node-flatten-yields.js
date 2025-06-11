const du = require('../lib/dateUtils.js');
const fs = require("fs");
const process = require("process");

// read in from stdin, the markit response and pull out the yield
// history and export the details.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
let resp = [];
// structure as a list of elements by ticker id, each an array of yields, 
// flatten into a single array and write.
for (const i in json) {
    json[i].forEach(function (obj) { resp.push(obj); });
}
console.log(JSON.stringify(resp));
