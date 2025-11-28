import dynamicSort from '../lib/dynamicSort.mjs'
import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

// import filter list for parcel prefixes.

const prefixesString = readFileSync(process.argv[2], 'utf8');
const prefixes = prefixesString
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
function isValidParcel(parcelString) {
    for (const prefix of prefixes) {
        if (parcelString.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
const htmlString = readFileSync(process.argv[3], 'utf8');
const root = parse(htmlString);
const lotListElement = root.querySelector('#list');
const childCnt = lotListElement.children.length;
//console.error(`childNodes.length = ${childCnt}`);

const oldDate = new Date('2000-01-01T00:00:00Z');

const result = [];
for (let i = 0; i < childCnt; i++) {

    const row = lotListElement.children[i];
    //console.error(row.structure);

    const parcelString = row.textContent
        .replace(/^.*Mblu:/, '')
        .replace(/[\s\n\r]/g, '')
        .trim()
        .replace(/\/$/, '')
        .replace(/\//g, '-')

    if (!isValidParcel(parcelString)) {
        console.error(`Skipping invalid parcel: ${parcelString}`);
        continue;
    }

    const lot = parcelString.split('-')[2];
    const linkElement = row.children[0];

    const addressString = linkElement.text;

    const pidString = linkElement.getAttribute('href')
        .replace(/Parcel.aspx\?pid=/, '');

    result.push({
        lot: lot*1,
        address: addressString,
        pid: pidString*1,
        parcel: parcelString,
        updateDate: oldDate,
        queryDate: oldDate
    })
}

console.log(JSON.stringify(result.sort(dynamicSort('lot')), null, 2));