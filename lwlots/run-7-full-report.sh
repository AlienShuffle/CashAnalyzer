#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=full-report
listTmpFile=$exportPrefix.tmp.json
node ./node-full-report.js lot-normalized.json lot-taxes.json addr-list.json owner-list.json |
    jq . >"$exportPrefix.json"
cat $exportPrefix.json | (
    echo "lot,gisLink,taxLink,location,useCode,lake,acres,livingArea,yearBuilt,relatedEmptyLots,relatedHomeLots,delinquent,previousDelinquency,valuationImprove,valuationLand,valuationTotal,saleDate,taxesDue,relatedLots,generalOwner,owners"
    jq -r '.[] | [.lot,.gisLink,.taxLink,.location,.propertyUseCode,.lake,.acres,.livingArea,.yearBuilt,.relatedEmptyLotCnt,.relatedHomeLotCnt,.delinquent,.previousDelinquency,.valuationImprove,.valuationLand,.valuationTotal,.saleDate,.taxStatus.taxesDue,(.relatedLots|join(";")),.generalOwner,(.owners|join(";"))] | @csv'
) >"$exportPrefix".csv
rm -f "$listTmpFile"

#.relatedEmptyLotCnt,.relatedHomeLotCnt,.delinquent,.previousDelinquency,.taxStatus.taxesDue
