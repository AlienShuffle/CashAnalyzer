#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=9-stats
listTmpFile=$exportPrefix.tmp.json
cat 8-filtered-report.json |
    node ./node-9-stats.js |
    tee "$exportPrefix.csv"
rm -f "$listTmpFile"
