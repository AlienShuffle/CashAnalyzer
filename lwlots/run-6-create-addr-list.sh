#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=addr-list
listTmpFile=$exportPrefix.tmp.json
cat lot-normalized.json |
    node ./node-addr-list.js >"$listTmpFile"
cat "$listTmpFile" | jq -s 'flatten | unique_by(.address) | sort_by(.address)' >$exportPrefix.json
#cat $exportPrefix.json | (
#    echo "lot,pid,parcel,location"
#    jq -r '.[] | [.lot,.pid,.parcel,.location] | @csv'
#) >"$exportPrefix".csv
rm -f "$listTmpFile"
