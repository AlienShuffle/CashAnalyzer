#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
# First, we rectify the names.

exportPrefix=4-lot-normalized
cat 2-lot-detail.json | node ./node-4-normalize-names.js | jq . >$exportPrefix.json
cat $exportPrefix.json | ./csv-2-lot-detail.sh >$exportPrefix.csv
rm -f $listTmpFile $curlTmpFile

