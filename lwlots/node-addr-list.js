import dynamicSort from '../lib/dynamicSort.mjs';
import { readFileSync } from 'fs';

// [{ address, lots:[lot, ...] }, ...]
let addrList = [];

function addAddressToList(address, lot, owner) {
    for (let i = 0; i < addrList.length; i++) {
        if (addrList[i].address === address) {
            for (let j = 0; j < addrList[i].lots.length; j++) {
                if (addrList[i].lots[j].lot === lot) {
                    return;
                }
            }
            addrList[i].lots.push(lot);
            addrList[i].lots = addrList[i].lots.sort();
        }
    }
    addrList.push({
        address: address,
        lots: [lot]
    });
}

// read HTML from file given as stdin, this is a lot-detail.json.
const inputBuffer = readFileSync(0, 'utf8');
const json = JSON.parse(inputBuffer);

for (let i = 0; i < json.length; i++) {
    const lot = json[i];
    addAddressToList(lot.address, lot.lot, lot.generalOwner);
}
console.log(JSON.stringify(addrList.sort(dynamicSort('address'))));