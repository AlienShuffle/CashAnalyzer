import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

const htmlString = readFileSync(process.stdin.fd, 'utf8');

const root = parse(htmlString);

const lotListElement = root.querySelector('#list');
const childCnt = lotListElement.children.length;
console.log(`childNodes.length = ${childCnt.length}`);
for (let i = 0; i < childCnt; i++) {

    const lotRow = lotListElement.firstElementChild;
    console.log(`href = ${lotRow.querySelector('href')}`)

    //console.log('Title:', title);
}