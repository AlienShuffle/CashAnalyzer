#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
# Usage: ./run-6-create-addr-list.sh [directory]
#   directory: optional target directory (defaults to current directory)

# Determine working directory
workDir="${1:-.}"

# Get the directory where this script is located
scriptDir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exportPrefix=6-addr-list
listTmpFile=$exportPrefix.tmp.json
cd "$workDir" || { echo "Error: Cannot change to directory: $workDir"; exit 1; }

cat 4-lot-normalized.json |
    node "$scriptDir/node-6-addr-list.js" >"$listTmpFile"
cat "$listTmpFile" | jq -s 'flatten | unique_by(.address) | sort_by(.address)' >$exportPrefix.json
rm -f "$listTmpFile"
