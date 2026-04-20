#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=5-owner-list
listTmpFile=$exportPrefix.tmp.json
cat 4-lot-normalized.json |
    node ./node-5-owner-list.js >"$listTmpFile"
#echo flatten now....
cat "$listTmpFile" | jq -s 'flatten | unique_by(.owner) | sort_by(.owner)' >$exportPrefix.json
cat $exportPrefix.json | (
    echo "owner,generalOwner,emptyLotCnt,homeLotCnt,previousLotCnt,relatedLots,previousLots"
    jq -r '.[] | [.owner,.generalOwner,.emptyLotCnt,.homeLotCnt,.previousLotCnt,(.relatedLots|join(";")),(.previousLots|join(";"))] | @csv'
) >"$exportPrefix".csv
rm -f "$listTmpFile"