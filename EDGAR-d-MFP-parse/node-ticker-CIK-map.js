import { readFileSync } from 'fs';
import process from 'process';

const ticker = process.argv[2];

// read in from stdin, the CIKD list.
const stdinBuffer = readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
// go through each ticker and print the associated CIK too.
for (let i = 0; i < json.length; i++) {
    if (json[i].ticker == ticker) {
        console.log(json[i].cikTen);
        break;
    }
}