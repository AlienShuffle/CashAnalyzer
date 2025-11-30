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
            return taxEntry;
        }
    }
    return null;
}

function getIdForAddress(address) {
    for (let i = 0; i < addrJson.length; i++) {
        const addrObj = ownerJson[i];
        if (addrObj.address === address) {
            return addrObj.aid;
        }
    }
    return;
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
function getIdForOwner(owner) {
    for (let i = 0; i < ownerJson.length; i++) {
        const ownerObj = ownerJson[i];
        if (ownerObj.owner === owner) {
            return ownerObj.oid;
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
    const thisLot = result[i].lot;

    // create related lots list
    let relatedLots = [];
    function insertRelatedLots(lotObjList) {
        for (let i = 0; i < lotObjList.length; i++) {
            const lotObj = lotObjList[i];
            // don't insert self
            if (lotObj.lot === thisLot)
                continue;
            // only insert Deed and General lots, not previos owner lots.
            if (!lotObj.lot.includes('Deed') &&
                !lotObj.lot.includes('General'))
                continue;
            // don't insert duplicates
            for (let i = 0; i < relatedLots.length; i++) {
                if (lotObj.lot === relatedLots[i])
                    continue;
            }
            // insert lot
            relatedLots.push(lotObj.lot);
        }
    }

    // get tax status for lot
    const taxObj = getTaxStatusForLot(result[i].lot);
    if (!taxObj) {
        // taxes are current.
        result[i].delinquent = false;
        result[i].previousDelinquency = false;
    } else {
        result[i].delinquent = taxObj.delinquent;
        result[i].previousDelinquency = taxObj.previousDelinquency;
        if (taxObj.taxStatus) {
            result[i].taxStatus = structuredClone(taxObj.status);
        }
    }

    // insert address link id
    result[i].aid = getIdForAddress(result[i].address);
    // insert general owner link id
    result[i].oid = getIdForOwner(result[i].generalOwner);
    // insert owner link ids
    for (let j = 0; j < result[i].owners.length; j++) {
        result[i].owners[j].oid = getIdForOwner(result[i].owners[j]);
    }

    // find related lots by address and owners
    const addressLots = getLotListForAddress(result[i].address);
    if (addressLots) insertRelatedLots(addressLots);
    const generalOwnerLots = getLotListForOwner(result[i].generalOwner);
    if (generalOwnerLots) insertRelatedLots(generalOwnerLots);
    for (let j = 0; j < result[i].owners.length; j++) {
        const ownerLots = getLotListForOwner(result[i].owners[j]);
        if (ownerLots) insertRelatedLots(ownerLots);
    }

    // if we found related lots, insert in result object.
    if (relatedLots.length > 0) {
        result[i].relatedLots = relatedLots.sort();
    }
}
console.log(JSON.stringify(result));