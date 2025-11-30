import dynamicSort from '../lib/dynamicSort.mjs';
import { readFileSync } from 'fs';

// [{ owner, lots:[{type, lot}, ...] }, ...]
let ownersList = [];

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
        lots: [{
            lot: lot,
            type: [type],
        }]
    });
}

// read HTML from file given as stdin, this is a lot-detail.json.
const inputBuffer = readFileSync(0, 'utf8');
const json = JSON.parse(inputBuffer);

for (let i = 0; i < json.length; i++) {
    const lot = json[i];
    console.error(`Processing ${lot.lot}, owner list size ${ownersList.length}`);
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
console.log(JSON.stringify(ownersList.sort(dynamicSort('owner'))));