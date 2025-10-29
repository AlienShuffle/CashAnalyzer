import { readFileSync } from 'fs';

// read in from stdin, the JSON object.
const stdinBuffer = readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
// return the list of object keys in the top level of the object.
console.log(Object.keys(json[0]));