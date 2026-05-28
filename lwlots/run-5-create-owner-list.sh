#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
# Usage: ./run-5-create-owner-list.sh [directory]
#   directory: optional target directory (defaults to current directory)

# Determine working directory
workDir="${1:-.}"

# Get the directory where this script is located
scriptDir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exportPrefix=5-owner-list
listTmpFile=$exportPrefix.tmp.json
cd "$workDir" || { echo "Error: Cannot change to directory: $workDir"; exit 1; }

cat 4-lot-normalized.json |
    node "$scriptDir/node-5-owner-list.js" >"$listTmpFile"
#echo flatten now....
cat "$listTmpFile" | jq -s 'flatten | unique_by(.owner) | sort_by(.owner)' >$exportPrefix.json
cat $exportPrefix.json | "$scriptDir/csv-5-owner-list.sh" >"$exportPrefix".csv
rm -f "$listTmpFile"