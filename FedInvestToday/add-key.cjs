//useful for transition of old data to new data.
const fs = require('fs');
const du = require('../lib/dateUtils.js');
// read in from stdin, the TIPS data to add a key attribute.
const stdinBuffer = fs.readFileSync(process.stdin.fd);
const json = JSON.parse(stdinBuffer);
for (let i = 0; i < json.length; i++) {
    const rate = (parseFloat(json[i].rate) / 100).toFixed(5);
    const maturitydate = du.getISOString(new Date(json[i].maturitydate));
    json[i].maturitydate = maturitydate;
    json[i].key = maturitydate + '-' + rate;
    json[i].rate = rate;
}
console.log(JSON.stringify(json));