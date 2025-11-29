import dynamicSort from '../lib/dynamicSort.mjs'
import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

// read HTML from file given as 1st argument, this is a parcel detail report from the county GIS site.
const htmlString = readFileSync(process.argv[2], 'utf8');
const root = parse(htmlString);

const locationString = root.querySelector('#MainContent_lblLocation').text;
const parcelStringRaw = root.querySelector('#MainContent_lblMblu').text
    .replace(/^.*Mblu:/, '')
    .replace(/[\s\n\r]/g, '')
    .trim()
    .replace(/\/$/, '')
    .replace(/\//g, '-');
const parcelStringSplit = parcelStringRaw.split('-');
const parcelString = parcelStringSplit[0] + '-' + parcelStringSplit[1] + '-' + parcelStringSplit[2] + '.' + parcelStringSplit[3];
const lotString = parcelStringSplit[2];

//#MainContent_lblGenOwner
const generalOwnerString = root.querySelector('#MainContent_lblGenOwner').text;

const propertyTypeString = root.querySelector('#MainContent_lblPbn').text;
const pidString = root.querySelector('#MainContent_lblPid').text;
const addressString = root.querySelector('#MainContent_lblAddr1').text
    .trim();
const acresString = root.querySelector('#MainContent_lblLndAcres').text;

// list of co-owners retrieval
const ownersRootElement = root.querySelector('#MainContent_grdSales');
const ownersString = ownersRootElement.children[2].children[0].text;
const owners = ownersString
    .split(';')
    .map(name => name.trim())
    .filter(name => name.length > 0);

// latest valuations table retrieval
const valuationRootElement = root.querySelector('#MainContent_grdHistoryValuesAsmt');
const valuationSectionElement = valuationRootElement.children[2];
const valuationYearString = valuationSectionElement.children[0].text;
const valuationImproveString = valuationSectionElement.children[1].text;
const valuationLandString = valuationSectionElement.children[2].text;
const valuationTotalString = valuationSectionElement.children[3].text;

const result = {
    location: locationString,
    parcel: parcelString,
    lot: lotString * 1,
    propertyType: propertyTypeString,
    pid: pidString * 1,
    address: addressString,
    acres: acresString * 1,
    generalOwner: generalOwnerString,
    owners: owners,
    valuationYearString: valuationYearString * 1,
    valuationImproveString: valuationImproveString.replace(/[\$,]/g, '') * 1,
    valuationLandString: valuationLandString.replace(/[\$,]/g, '') * 1,
    valuationTotalString: valuationTotalString.replace(/[\$,]/g, '') * 1,
    timestamp: new Date
}

console.log(JSON.stringify(result));