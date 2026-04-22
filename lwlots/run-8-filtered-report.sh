#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=8-filtered-report
listTmpFile=$exportPrefix.tmp.json
cat 7-full-report.json |
    node ./node-8-filter-report.js |
    jq . >"$exportPrefix.json"
cat $exportPrefix.json | ./csv-7-full-report.sh >"$exportPrefix".csv
rm -f "$listTmpFile"
