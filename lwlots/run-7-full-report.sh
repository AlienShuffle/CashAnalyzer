#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=7-full-report
listTmpFile=$exportPrefix.tmp.json
node ./node-7-full-report.js 3-lot-taxes.json 4-lot-normalized.json 5-owner-list.json 6-addr-list.json |
    jq . >"$exportPrefix.json"
cat $exportPrefix.json | ./csv-7-full-report.sh >"$exportPrefix".csv
rm -f "$listTmpFile"
