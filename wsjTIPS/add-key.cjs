//useful for transition of old data to new data.
const fs = require('fs');
// read in from stdin, the TIPS data to add a key attribute.
const stdinBuffer = fs.readFileSync(process.stdin.fd);
const json = JSON.parse(stdinBuffer);
for (let i = 0; i < json.length; i++) {
    json[i].key = json[i].maturity + '-' + json[i].coupon.toFixed(5);
}
console.log(JSON.stringify(json));