import dynamicSort from '../lib/dynamicSort.mjs';
import { readFileSync } from 'fs';

// [{ address, lots:[lot, ...] }, ...]
let addrList = [];

// Hash to store address -> aid mapping
const addressHashMap = new Map();

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function getOrCreateAid(address) {
    if (!addressHashMap.has(address)) {
        addressHashMap.set(address, hashCode(address));
    }
    return addressHashMap.get(address);
}

function addAddressToList(address, lot) {
    for (let i = 0; i < addrList.length; i++) {
        if (addrList[i].address === address) {
            for (let j = 0; j < addrList[i].lots.length; j++) {
                if (addrList[i].lots[j].lot === lot) {
                    return;
                }
            }
            addrList[i].lots.push({
                lot: lot,
                type: ['Address']
            });
            addrList[i].lots = addrList[i].lots.sort();
        }
    }
    addrList.push({
        address: address,
        aid: getOrCreateAid(address),
        lots: [{
            lot: lot,
            type: ['Address']
        }]
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