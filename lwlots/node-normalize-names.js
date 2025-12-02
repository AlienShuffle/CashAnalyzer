import { normalizeName } from './node-common-code.js';
import { readFileSync } from 'fs';


// read HTML from file given as stdin, this is a lot-detail.json.
const lotDetailBuffer = readFileSync(0, 'utf8');
const lotDetailJson = JSON.parse(lotDetailBuffer);

// walk through all the lots, then full report including related lots and tax status.
let result = [];
for (let i = 0; i < lotDetailJson.length; i++) {
    result[i] = lotDetailJson[i];
    result[i].generalOwner = normalizeName(result[i].generalOwner);
    for (let j = 0; j < result[i].owners.length; j++) {
        result[i].owners[j] = normalizeName(result[i].owners[j]);
    }
    for (let j = 0; j < result[i].previousOwners.length; j++) {
        for (let k = 0; k < result[i].previousOwners[j].owners.length; k++) {
            result[i].previousOwners[j].owners[k] = normalizeName(result[i].previousOwners[j].owners[k]);
        }
    }
}
console.log(JSON.stringify(result));