#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=owner-list
listTmpFile=$exportPrefix.tmp.json
cat lot-detail.json |
    node ./node-owner-list.js >"$listTmpFile"
#echo flatten now....
cat "$listTmpFile" | jq -s 'flatten | unique_by(.owner) | sort_by(.owner)' >$exportPrefix.json
#cat $exportPrefix.json | (
#    echo "lot,pid,parcel,location"
#    jq -r '.[] | [.lot,.pid,.parcel,.location] | @csv'
#) >"$exportPrefix".csv
rm -f "$listTmpFile"
