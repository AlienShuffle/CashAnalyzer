const fs = require("fs");

//https://data.sec.gov/submissions/CIK0000320193.json 

// read in from stdin, the CIKD list and create a stream of URLs for download.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
// go through each ticker report provided, see if it is in the track list, publish map if in the list.
for (let i = 0; i < json.length; i++) {
    const cik = json[i].cik;
    console.log(String(cik).padStart(10, '0'));
}