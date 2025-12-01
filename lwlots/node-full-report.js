import dynamicSort from '../lib/dynamicSort.mjs';
import { readFileSync } from 'fs';


// read HTML from file given as stdin, this is a lot-detail.json.
if (process.argv.length != 6) {
    console.error('Usage: node node-full-report.js lot-detail.json lot-taxes.json addr-list.json owner-list.json');
    process.exit(1);
}
const lotDetailBuffer = readFileSync(process.argv[2], 'utf8');
const lotDetailJson = JSON.parse(lotDetailBuffer);
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
        const addrObj = addrJson[i];
        if (addrObj.address === address) {
            return addrObj.aid;
        }
    }
    return;
}
function getLotListForAddress(address) {
    for (let i = 0; i < addrJson.length; i++) {
        const addrObj = addrJson[i];
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
for (let i = 0; i < lotDetailJson.length; i++) {
    result[i] = lotDetailJson[i];
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
            if (!lotObj.type.includes('Deed') &&
                !lotObj.type.includes('Address') &&
                !lotObj.type.includes('General'))
                continue;
            // don't insert duplicates
            let newLot = true;
            for (let i = 0; i < relatedLots.length; i++) {
                if (lotObj.lot === relatedLots[i]) {
                    newLot = false;
                    break;
                }
            }
            // insert lot it is a new one.
            if (newLot) relatedLots.push(lotObj.lot);
        }
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
    //console.error(`Processed aid=${result[i].aid}, lot=${result[i].lot}`);
    // insert general owner link id
    result[i].oid = getIdForOwner(result[i].generalOwner);
    // insert owner link ids
    result[i].ownersOid = [];
    for (let j = 0; j < result[i].owners.length; j++) {
        result[i].ownersOid[j] = getIdForOwner(result[i].owners[j]);
    }
    // insert previous owners link ids
    for (let j = 0; j < result[i].previousOwners.length; j++) {
        result[i].previousOwners[j].ownersOid = [];
        for (let k = 0; k < result[i].previousOwners[j].owners.length; k++) {
            result[i].previousOwners[j].ownersOid[k] = getIdForOwner(result[i].previousOwners[j].owners[k]);
        }
    }
}
console.log(JSON.stringify(result));