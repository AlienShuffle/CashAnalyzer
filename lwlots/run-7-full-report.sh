#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
# Usage: ./run-7-full-report.sh [directory]
#   directory: optional target directory (defaults to current directory)

# Determine working directory
workDir="${1:-.}"

# Get the directory where this script is located
scriptDir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exportPrefix=7-full-report
listTmpFile=$exportPrefix.tmp.json
cd "$workDir" || { echo "Error: Cannot change to directory: $workDir"; exit 1; }

node "$scriptDir/node-7-full-report.js" 3-lot-taxes.json 4-lot-normalized.json 5-owner-list.json 6-addr-list.json |
    jq . >"$exportPrefix.json"
cat $exportPrefix.json | "$scriptDir/csv-7-full-report.sh" >"$exportPrefix".csv
rm -f "$listTmpFile"
