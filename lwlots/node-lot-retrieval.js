import dynamicSort from '../lib/dynamicSort.mjs'
import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';
import process from 'node:process';
import { timeStamp } from 'node:console';

// import filter list for parcel prefixes. All entries must start with one of these prefixes.
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

// read HTML from file given as 2nd argument, this is a street report from the county GIS site.
const htmlString = readFileSync(process.argv[3], 'utf8');
const root = parse(htmlString);
const lotListElement = root.querySelector('#list');
const childCnt = lotListElement.children.length;
//console.error(`childNodes.length = ${childCnt}`);

const oldDate = new Date('2000-01-01T00:00:00Z');

const result = [];
for (let i = 0; i < childCnt; i++) {

    const row = lotListElement.children[i];
    const linkElement = row.children[0];

    const locationString = linkElement.text;

    const parcelStringRaw = row.textContent
        .replace(/^.*Mblu:/, '')
        .replace(/[\s\n\r]/g, '')
        .trim()
        .replace(/\/$/, '')
        .replace(/\//g, '-')
    const parcelStringSplit = parcelStringRaw.split('-');
    const parcelString = parcelStringSplit[0] + '-' + parcelStringSplit[1] + '-' + parcelStringSplit[2] + '.' + parcelStringSplit[3];

    if (!isValidParcel(parcelString)) {
        console.error(`Skipping invalid parcel: ${locationString} : ${parcelString}`);
        continue;
    }

    const lotString = parcelStringSplit[2];


    const pidString = linkElement.getAttribute('href')
        .replace(/Parcel.aspx\?pid=/, '');

    result.push({
        location: locationString,
        parcel: parcelString,
        lot: lotString * 1,
        pid: pidString * 1,
        timetamp: oldDate,
    })
}

console.log(JSON.stringify(result.sort(dynamicSort('lot'))));