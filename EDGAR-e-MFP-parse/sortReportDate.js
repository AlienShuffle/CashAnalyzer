import { duGetISOString, duGetDateFromYYYYMMDD } from "../lib/dateUtils.mjs";
import { readFileSync } from 'fs';
import process from 'process';
import dynamicSort from '../lib/dynamicSort.mjs';
const stdinBuffer = readFileSync(process.stdin.fd, 'utf-8');
const inputJson = JSON.parse(stdinBuffer);
let outputJson = [];
for (let i = 0; i < inputJson.length; i++) {
    let found = false;
    for (let o = 0; o < outputJson.length; o++) {
        if (inputJson[i].ticker == outputJson[o].ticker &&
            inputJson[i].reportDate == outputJson[o].reportDate
        ) {
            const inputFilingDate = duGetDateFromYYYYMMDD(inputJson[i].filingDate);
            const outputFilingDate = duGetDateFromYYYYMMDD(outputJson[o].filingDate);
            if (inputFilingDate.getTime() > outputFilingDate.getTime()) {
                outputJson.splice(o, 1, inputJson[i]);
            }
            found = true;
            break;
        }
    }
    if (!found) outputJson.push(inputJson[i]);
}
console.log(JSON.stringify(outputJson.sort(dynamicSort('-reportDate'))));