// import { isEmptyLot, isHomeLot, normalizeName } from './node-property-codes.js';

// these are property use codes for lots.
// shared between node-owner-list.js and node-full-report.js
export function isEmptyLot(propertyUseCode) {
    return propertyUseCode === 100;
}

export function isHomeLot(propertyUseCode) {
    return propertyUseCode === 101 ||
        propertyUseCode === 108 ||
        propertyUseCode === 109 ||
        propertyUseCode === 121;
}

export function normalizeName(name) {
    return name.trim().toUpperCase()
        .replace(/, LLC/g, ' LLC')
        .replace(/,LLC/g, ' LLC')
        .replace(/, INC/g, ' INC')
        .replace(/,INC/g, ' INC')
        .replace(/AND SONS/g, '& SONS')
        .replace(/J M A C/g, 'JMAC');
}
