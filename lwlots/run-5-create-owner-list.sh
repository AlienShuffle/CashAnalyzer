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
cat $exportPrefix.json | ./csv-5-owner-list.sh >"$exportPrefix".csv
rm -f "$listTmpFile"