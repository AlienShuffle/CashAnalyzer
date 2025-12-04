import { isEmptyLot, isHomeLot } from './node-common-code.js';
import dynamicSort from '../lib/dynamicSort.mjs';
import { readFileSync } from 'fs';

// [{ owner, lots:[{type, lot}, ...] }, ...]
let ownersList = [];
let oid = 50001;

function addOwnerToList(owner, lot, type) {
    for (let i = 0; i < ownersList.length; i++) {
        if (ownersList[i].owner === owner) {
            for (let j = 0; j < ownersList[i].lots.length; j++) {
                if (ownersList[i].lots[j].lot === lot) {
                    for (let k = 0; k < ownersList[i].lots[j].type.length; k++) {
                        if (ownersList[i].lots[j].type[k] === type) {
                            return;
                        }
                        ownersList[i].lots[j].type.push(type);
                        return;
                    }
                }
            }
            ownersList[i].lots.push({
                lot: lot,
                type: [type],
            });
            ownersList[i].lots = ownersList[i].lots.sort(dynamicSort('lot'));
            return;
        }
    }
    ownersList.push({
        owner: owner,
        oid: oid++,
        lots: [{
            lot: lot,
            type: [type],
        }]
    });
}

// read HTML from file given as stdin, this is a lot-detail.json.
const inputBuffer = readFileSync(0, 'utf8');
const lotDetailJson = JSON.parse(inputBuffer);
function getLotDetail(lot) {
    for (let i = 0; i < lotDetailJson.length; i++) {
        const lotDetail = lotDetailJson[i];
        if (lotDetail.lot === lot) {
            return lotDetail;
        }
    }
    return null;
}

for (let i = 0; i < lotDetailJson.length; i++) {
    const lot = lotDetailJson[i];
    //console.error(`Processing ${lot.lot}, owner list size ${ownersList.length}`);
    addOwnerToList(lot.generalOwner, lot.lot, 'General');
    for (let j = 0; j < lot.owners.length; j++) {
        addOwnerToList(lot.owners[j], lot.lot, 'Deed');
    }
    for (let p = 0; p < lot.previousOwners.length; p++) {
        for (let j = 0; j < lot.previousOwners[p].owners.length; j++) {
            addOwnerToList(lot.previousOwners[p].owners[j], lot.lot, 'Previous');
        }
    }
}

for (let i = 0; i < ownersList.length; i++) {
    ownersList[i].generalOwner = false;
    ownersList[i].emptyLotCnt = 0;
    ownersList[i].homeLotCnt = 0;
    ownersList[i].previousLotCnt = 0;
    //ownersList[i].delinquentCnt = 0;
    //ownersList[i].previousDelinquencyCnt = 0;
    ownersList[i].relatedLots = [];
    ownersList[i].previousLots = [];
    for (let j = 0; j < ownersList[i].lots.length; j++) {
        if (!ownersList[i].lots[j].type.includes('Deed') &&
            !ownersList[i].lots[j].type.includes('General')) {
            ownersList[i].previousLots.push(ownersList[i].lots[j].lot);
            ownersList[i].previousLotCnt++;
            continue;
        }
        if (ownersList[i].lots[j].type.includes('General')) ownersList[i].generalOwner = true;
        ownersList[i].relatedLots.push(ownersList[i].lots[j].lot);
        const lotDetail = getLotDetail(ownersList[i].lots[j].lot);
        if (lotDetail) {
            const propertyUseCode = lotDetail.propertyUseCode;
            //console.error(`propertyType for lot ${ownersList[i].lots[j].lot} is ${propertyUseCode}`);
            if (isEmptyLot(propertyUseCode)) ownersList[i].emptyLotCnt++;
            if (isHomeLot(propertyUseCode)) ownersList[i].homeLotCnt++;
            //console.error(`${lotDetail.lot}: ${lotDetail.delinquent} ${lotDetail.previousDelinquency} `)
            //if (lotDetail.delinquent) ownersList[i].delinquentCnt++;
            //if (lotDetail.previousDelinquency) ownersList[i].previousDelinquencyCnt++
        }
    }
    ownersList[i].relatedLots = ownersList[i].relatedLots.sort();
    ownersList[i].previousLots = ownersList[i].previousLots.sort();
}
console.log(JSON.stringify(ownersList.sort(dynamicSort('owner'))));