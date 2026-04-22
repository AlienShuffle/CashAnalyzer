import { readFileSync } from 'fs';

// export field separator for the stats output. '\t\ for tab, ',' for comma, etc.
const sep = ',';

// Read the lot report from stdin and parse it as JSON.
const lotReportBuffer = readFileSync(0, 'utf8');
const lotDetailsJson = JSON.parse(lotReportBuffer);
// Build a map of all lotDetails. 
const lotDetailsMap = new Map();
for (let i = 0; i < lotDetailsJson.length; i++) {
    lotDetailsMap.set(lotDetailsJson[i].lot, lotDetailsJson[i]);
}
function findLotReport(lot) {
    return lotDetailsMap.get(lot);
}

// Helper function to calculate and print valuation stats for a given set of lots based on a constraint and value extractor.
function calculateValuationStats(lots, constraint, valueExtractor, prefix) {
    //console.log(`---\n${prefix} Valuation Stats: lots.size=${lots.size}`);
    let valuations = [];
    for (const lotReport of lots.values()) {
        if (!constraint(lotReport)) {
            continue;
        }
        valuations.push(valueExtractor(lotReport));
    }
    const count = valuations.length;
    let total = 0;
    let countForAverage = 0;
    let min = Number.MAX_VALUE;
    let max = Number.MIN_VALUE;
    for (const val of valuations) {
        total += val;
        countForAverage++;
        if (val < min) min = val;
        if (val > max) max = val;
    }
    let average = countForAverage > 0 ? Math.round(total / countForAverage) : 0;
    console.log(`${prefix.trim()} Count${sep}${count}`);
    console.log(`Average ${prefix} Valuation${sep}${average}`);
    console.log(`Minimum ${prefix} Valuation${sep}${min}`);
    console.log(`Maximum ${prefix} Valuation${sep}${max}`);
}

// Number of lots in the report.
console.log(`---\nLot Counts`);
const lotCount = lotDetailsJson.length;
console.log(`Lot Count${sep}${lotCount}`);

// Number of lots with a home built in the report.
const homeLotCount = lotDetailsJson.filter(lot => lot.yearBuilt).length;
console.log(`Home Lot Count${sep}${homeLotCount}`);

// Number of lots without a home built in the report.
const emptyLotCount = lotDetailsJson.filter(lot => !lot.yearBuilt).length;
console.log(`Empty Lot Count${sep}${emptyLotCount}`);


// Number of lots by propertyType in the report.
console.log(`-`);
const propertyTypeCounts = {};
for (let i = 0; i < lotDetailsJson.length; i++) {
    const lotReport = lotDetailsJson[i];
    if (propertyTypeCounts[lotReport.propertyType]) {
        propertyTypeCounts[lotReport.propertyType]++;
    } else {
        propertyTypeCounts[lotReport.propertyType] = 1;
    }
}
for (const propertyType in propertyTypeCounts) {
    console.log(`${propertyType.replace(/,/g, ' ')}${sep}${propertyTypeCounts[propertyType]}`);
}

// Number of Lakefront lots in the report (Fawn or Wynonah).
console.log(`-`);
const lakeFrontLotCount = lotDetailsJson.filter(lot => lot.lake).length;
const fawnLakeFrontLotCount = lotDetailsJson.filter(lot => lot.lake === "F").length;
const wynonahLakeFrontLotCount = lotDetailsJson.filter(lot => lot.lake === "W").length;
console.log(`Lakefront Lot Count${sep}${lakeFrontLotCount}`);
console.log(`Fawn Lakefront Lot Count${sep}${fawnLakeFrontLotCount}`);
console.log(`Wynonah Lakefront Lot Count${sep}${wynonahLakeFrontLotCount}`);

// average, and maximum number of lots associated with an owner in the report.
console.log(`---\nLots Per Owner Counts`);
let totalLotsPerOwner = 0;
let ownerCount = 0;
let maximumLotsPerOwner = Number.MIN_VALUE;
for (let i = 0; i < lotDetailsJson.length; i++) {
    const lotReport = lotDetailsJson[i];
    totalLotsPerOwner += lotReport.relatedEmptyLotCnt + lotReport.relatedHomeLotCnt + 1;
    ownerCount++;
    if (lotReport.relatedEmptyLotCnt + lotReport.relatedHomeLotCnt + 1 > maximumLotsPerOwner) {
        maximumLotsPerOwner = lotReport.relatedEmptyLotCnt + lotReport.relatedHomeLotCnt + 1;
    }
}
console.log(`Maximum Lots Per Owner${sep}${maximumLotsPerOwner}`);
const averageLotsPerOwner = (totalLotsPerOwner / ownerCount).toFixed(2) * 1;
console.log(`Average Lots Per Owner${sep}${averageLotsPerOwner}`);

// Number of unique generalOwners in the report.
console.log(`---\nGeneral Owner Counts`);
const generalOwnersMap = new Map();
for (let i = 0; i < lotDetailsJson.length; i++) {
    if (!generalOwnersMap.has(lotDetailsJson[i].generalOwner)) {
        generalOwnersMap.set(lotDetailsJson[i].generalOwner, lotDetailsJson[i]);
    }
}
console.log(`General Owner Count${sep}${generalOwnersMap.size}`);

// Number unique generalOwners with a resident address in the report.
const generalOwnersWithResidentAddressMap = new Map();
for (let i = 0; i < lotDetailsJson.length; i++) {
    if (lotDetailsJson[i].isResident) {
        if (!generalOwnersWithResidentAddressMap.has(lotDetailsJson[i].generalOwner)) {
            generalOwnersWithResidentAddressMap.set(lotDetailsJson[i].generalOwner, lotDetailsJson[i]);
        }
    }
}
console.log(`General Owner With Resident Address Count${sep}${generalOwnersWithResidentAddressMap.size}`);

// Number of generalOwners with at least one lot with a house built in the report.
// only include the first appearance of a generalOwner lot that meets the criteria.
const generalOwnersWithHomeMap = new Map();
for (let i = 0; i < lotDetailsJson.length; i++) {
    if (lotDetailsJson[i].yearBuilt) {
        if (!generalOwnersWithHomeMap.has(lotDetailsJson[i].generalOwner)) {
            generalOwnersWithHomeMap.set(lotDetailsJson[i].generalOwner, lotDetailsJson[i]);
        }
    }
}
console.log(`General Owner With Home Count${sep}${generalOwnersWithHomeMap.size}`);

// Number of generalOwners with only empty lots and no homes built in the report.
const generalOwnersWithOnlyEmptyLotsMap = new Map();
for (let i = 0; i < lotDetailsJson.length; i++) {
    if (!lotDetailsJson[i].yearBuilt && lotDetailsJson[i].relatedHomeLotCnt == 0) {
        if (!generalOwnersWithOnlyEmptyLotsMap.has(lotDetailsJson[i].generalOwner)) {
            generalOwnersWithOnlyEmptyLotsMap.set(lotDetailsJson[i].generalOwner, lotDetailsJson[i]);
        }
    }
}
console.log(`General Owner With Only Empty Lots Count${sep}${generalOwnersWithOnlyEmptyLotsMap.size}`);

// New Section
console.log(`---\nHome Counts`);

// Number of lots with a Home built in the report.
const homeCount = lotDetailsJson.filter(lot => lot.yearBuilt).length;
console.log(`Home Count${sep}${homeCount}`);

// Number of Lots with a resident address in the report.
const homeWithResidentAddressCount = lotDetailsJson.filter(lot => lot.isResident && lot.yearBuilt).length;
console.log(`Home With Resident Address Count${sep}${homeWithResidentAddressCount}`);

// Number of Lakefront lots with a home built in the report.
console.log(`-`);
const lakeFrontHomeCount = lotDetailsJson.filter(lot => lot.yearBuilt && lot.lake).length;
console.log(`Lakefront Home Count${sep}${lakeFrontHomeCount}`);

// Number of Lots with a resident address and Lakefront in the report.
const residentLakeFrontHomeCount = lotDetailsJson.filter(lot => lot.isResident && lot.yearBuilt && lot.lake).length;
console.log(`Resident Lakefront Home Count${sep}${residentLakeFrontHomeCount}`);

console.log(`---\nEmpty Lot Counts`);
// Number of lots that are do not have homes built and not related to a home lot.
const noHomeLotCount = lotDetailsJson.filter(lot => !lot.yearBuilt && lot.relatedHomeLotCnt == 0).length;
console.log(`No Home Lot Count${sep}${noHomeLotCount}`);

// Number of lots that are do not have homes built and are Lakefront and are not related to a home lot.
const noHomeLakeFrontLotCount = lotDetailsJson.filter(lot => !lot.yearBuilt && lot.lake && lot.relatedHomeLotCnt == 0).length;
console.log(`No Home Lakefront Lot Count${sep}${noHomeLakeFrontLotCount}`);

// Number of lots with homes that have at least one empty lot associated with the owner.
const homeWithEmptyLotOwnerCount = lotDetailsJson.filter(lot => lot.yearBuilt && lot.relatedEmptyLotCnt > 0).length;
console.log(`Home With Empty Lot Owner Count${sep}${homeWithEmptyLotOwnerCount}`);

console.log(`---\nHome Lot Valuation Stats`);
calculateValuationStats(
    lotDetailsMap,
    lot => lot.valuationTotal > 0,
    lot => lot.valuationTotal,
    'Lot'
);

// Average total valuation of non-Lakefront home lots in the report.
console.log(`-`);
calculateValuationStats(
    lotDetailsMap,
    lot => lot.yearBuilt && !lot.lake,
    lot => lot.valuationTotal,
    'Non-Lakefront Home Lot'
);

// Average total valuation of Lakefront home lots in the report.
console.log(`-`);
calculateValuationStats(
    lotDetailsMap,
    lot => lot.yearBuilt && lot.lake,
    lot => lot.valuationTotal,
    'Lakefront Home Lot'
);

// Average total valuation of empty lots in the report.
console.log(`-`);
calculateValuationStats(
    lotDetailsMap,
    lot => !lot.yearBuilt,
    lot => lot.valuationTotal,
    'Empty Lot'
);

console.log(`---\nValuations of all lots associated with a homeowner generalOwner`);
console.log(`The home owner may not be generalOwner on all lots may be listed as secondary.`);
calculateValuationStats(
    generalOwnersWithHomeMap,
    lot => lot.yearBuilt || lot.relatedHomeLotCnt > 0,
    lot => {
        let total = lot.valuationTotal;
        const relatedLots = lot.relatedLots;
        if (relatedLots && relatedLots.length > 0) {
            for (let j = 0; j < relatedLots.length; j++) {
                const relatedLotReport = findLotReport(relatedLots[j]);
                if (relatedLotReport) {
                    total += relatedLotReport.valuationTotal;
                }
            }
        }
        return total;
    },
    'Homeowner (all)'
);

// Non-LakeFront home owner generalOwners
console.log(`-`);
calculateValuationStats(
    generalOwnersWithHomeMap,
    lot => (lot.yearBuilt || lot.relatedHomeLotCnt > 0) && !lot.lake,
    lot => {
        let total = lot.valuationTotal;
        const relatedLots = lot.relatedLots;
        if (relatedLots && relatedLots.length > 0) {
            for (let j = 0; j < relatedLots.length; j++) {
                const relatedLotReport = findLotReport(relatedLots[j]);
                if (relatedLotReport) {
                    total += relatedLotReport.valuationTotal;
                }
            }
        }
        return total;
    },
    'Non-Lakefront Homeowner (all)'
);

// LakeFront home owner generalOwners
console.log(`-`);
calculateValuationStats(
    generalOwnersWithHomeMap,
    lot => (lot.yearBuilt || lot.relatedHomeLotCnt > 0) && lot.lake,
    lot => {
        let total = lot.valuationTotal;
        const relatedLots = lot.relatedLots;
        if (relatedLots && relatedLots.length > 0) {
            for (let j = 0; j < relatedLots.length; j++) {
                const relatedLotReport = findLotReport(relatedLots[j]);
                if (relatedLotReport) {
                    total += relatedLotReport.valuationTotal;
                }
            }
        }
        return total;
    },
    'Lakefront Homeowner (all)'
);

// The average, min, and max valuation per generalOwner of all empty that have only related empty lots and no home built in the report.
console.log(`---\nValuations of all empty lots only related to a generalOwner of empty lots and no home built in the report.`);
calculateValuationStats(
    generalOwnersWithOnlyEmptyLotsMap,
    lot => !lot.yearBuilt,
    lot => {
        let total = lot.valuationTotal;
        const relatedLots = lot.relatedLots;
        if (relatedLots && relatedLots.length > 0) {
            for (let j = 0; j < relatedLots.length; j++) {
                const relatedLotReport = findLotReport(relatedLots[j]);
                if (relatedLotReport) {
                    total += relatedLotReport.valuationTotal;
                }
            }
        }
        return total;
    },
    'Empty Lot Owner (all)'
);