import dynamicSort from '../lib/dynamicSort.mjs';
import { readFileSync } from 'fs';


// read HTML from file given as stdin, this is a lot-detail.json.
if (process.argv.length != 6) {
    console.error('Usage: node node-full-report.js lot-detail.json lot-taxes.json addr-list.json owner-list.json');
    process.exit(1);
}
const detailBuffer = readFileSync(process.argv[2], 'utf8');
const detailJson = JSON.parse(detailBuffer);
const taxesBuffer = readFileSync(process.argv[3], 'utf8');
const taxesJson = JSON.parse(taxesBuffer);
const addrBuffer = readFileSync(process.argv[4], 'utf8');
const addrJson = JSON.parse(addrBuffer);
// [{ owner, lots:[{type, lot}, ...] }, ...]
const ownerBuffer = readFileSync(process.argv[5], 'utf8');
const ownerJson = JSON.parse(ownerBuffer);

function getTaxStatusForLot(lot) {
    for (let i = 0; i < taxesJson.length; i++) {
        const taxEntry = taxesJson[i];
        if (taxEntry.lot === lot) {
            return (taxEntry.delinquent) ? taxEntry.status : null;
        }
    }
    return null;
}
function getLotListForAddress(address) {
    for (let i = 0; i < addrJson.length; i++) {
        const addrObj = ownerJson[i];
        if (addrObj.address === address) {
            return addrObj.lots;
        }
    }
    return;
}
function getLotListForOwner(owner) {
    for (let i = 0; i < ownerJson.length; i++) {
        const ownerObj = ownerJson[i];
        if (ownerObj.owner === owner) {
            return ownerObj.lots;
        }
    }
    return;
}

// walk through all the lots, then full report including related lots and tax status.
let result = [];
for (let i = 0; i < detailJson.length; i++) {
    result[i] = detailJson[i];
    //console.error(`Processing ${result[i].lot}`);
    const taxObj = getTaxStatusForLot(result[i].lot);
    if (!taxObj) {
        result[i].delinquent = false;
    } else {
        result[i].delinquent = true;
        result[i].taxStatus = taxObj.status;
    }
    const addrObj = getLotListForAddress(result[i].address);
    if (addrObj) {
        result[i].relatedLotsByAddress = addrObj;
    }
    const ownerObj = getLotListForOwner(result[i].generalOwner);
    if (ownerObj) {
        result[i].relatedLotsByGeneralOwner = ownerObj;
    }
    for (let j = 0; j < result[i].owners.length; j++) {
        const ownerObj = getLotListForOwner(result[i].owners[j]);
        if (ownerObj) {
            if (result[i].relatedLotsByDeedOwners)
                result[i].relatedLotsByDeedOwners.push(ownerObj);
            else
                result[i].relatedLotsByDeedOwners = [ownerObj];
        }
    }
    for (let j = 0; j < result[i].previousOwners.length; j++) {
        const ownerObj = getLotListForOwner(result[i].previousOwners[j]);
        if (ownerObj) {
             if (result[i].relatedLotsByPreviousOwner)
                result[i].relatedLotsByPreviousOwner.push(ownerObj);
            else
                result[i].relatedLotsByPreviousOwner = [ownerObj];
        }
    }
}
console.log(JSON.stringify(result));