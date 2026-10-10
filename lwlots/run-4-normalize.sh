#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
# First, we rectify the names.
#
# Usage: ./run-4-normalize.sh [directory]
#   directory: optional target directory (defaults to current directory)

# Determine working directory
workDir="${1:-.}"

# Get the directory where this script is located
scriptDir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$scriptDir/../bin/nodeJobUtils.sh"

exportPrefix=4-lot-normalized
cd "$workDir" || { echo "Error: Cannot change to directory: $workDir"; exit 1; }

if ! runNode "$exportPrefix.json" 2-lot-detail.json "$scriptDir/node-4-normalize-names.js"; then
    echo "$(basename "$0") failed (status ${statuses[*]}), raw output kept in $exportPrefix.json.raw."
    exit 1
fi
cat "$exportPrefix.json" | "$scriptDir/csv-2-lot-detail.sh" > "$exportPrefix.csv"
rm -f $listTmpFile $curlTmpFile

