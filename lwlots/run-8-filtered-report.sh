#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
# Usage: ./run-8-filtered-report.sh [directory]
#   directory: optional target directory (defaults to current directory)

# Determine working directory
workDir="${1:-.}"

# Get the directory where this script is located
scriptDir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$scriptDir/../bin/nodeJobUtils.sh"

exportPrefix=8-filtered-report
listTmpFile=$exportPrefix.tmp.json
cd "$workDir" || { echo "Error: Cannot change to directory: $workDir"; exit 1; }

if ! runNode "$exportPrefix.json" 7-full-report.json "$scriptDir/node-8-filter-report.js"; then
    echo "$(basename "$0") failed (status ${statuses[*]}), raw output kept in $exportPrefix.json.raw."
    exit 1
fi
cat $exportPrefix.json | "$scriptDir/csv-7-full-report.sh" >"$exportPrefix".csv
rm -f "$listTmpFile"
