import { readFileSync } from 'fs';
import process from 'process';

const ticker = process.argv[2];

// read in from stdin, the CIK list.
const stdinBuffer = readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const item = json[0];

console.log(Object.keys(item));