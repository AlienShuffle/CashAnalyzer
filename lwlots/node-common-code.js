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
        .replace(/LLC,$/, 'LLC')
        .replace(/, INC/g, ' INC')
        .replace(/,INC/g, ' INC')
        .replace(/INC\.$/, 'INC')
        .replace(/INC,/, 'INC')
        .replace(/^LAKE WYNONAH PROP OWNRS ASN IN$/, 'LWPOA')
        .replace(/^LAKE WYNONAH PROP OWNERS ASSN$/, 'LWPOA')
        .replace(/^LAKE WYNONAH PROP OWNERS ASSO$/, 'LWPOA')
        .replace(/^LAKE WYNONAH PROP OWNERS INC$/, 'LWPOA')
        .replace(/^LAKE WYNONAH PROPERTY OWNERS$/, 'LWPOA')
        .replace(/^LAKE WYNONAH PRPTY OWNRS ASSN$/, 'LWPOA')
        .replace(/^LAKE WYNONAH P O ASSOC$/, 'LWPOA')
        .replace(/^LAKE WYNONAH UTIL INC$/, 'LAKE WYNONAH UTILITIES INC')
        .replace(/^LAKE WYNONAH UTILITIS INC$/, 'LAKE WYNONAH UTILITIES INC')
       .replace(/ N A$/, ' NA')
        .replace(/^THE BANK OF/, 'BANK OF')
        .replace(/NAT'L /, 'NATL ')
        .replace(/SECRETARY /, 'SEC ')
        .replace(/SEC\. /g, 'SEC ')
        .replace(/HOUSING AND$/, 'HUD')
        .replace(/HOUSING &$/, 'HUD')
        .replace(/HOUSING & URBAN DEVL$/, 'HUD')
        .replace(/HOUSING AND URBAN DEVL$/, 'HUD')
        .replace(/HOUSING & URBAN$/, 'HUD')
        .replace(/HOUSING AND URBAN$/, 'HUD')
        .replace(/AND SONS/g, '& SONS')
        .replace(/ AND /g, ' & ')
        .replace(/J M A C/g, 'JMAC');
}
