#!/usr/bin/bash
# usage: cnbcCollectionScript.sh <ticker-list-file>
source ../bin/nodeJobUtils.sh
if [ -z "$1" ] || [ ! -f "$1" ] || [ ! -r "$1" ] || [ ! -s "$1" ]; then
    echo "Missing, unreadable or empty CNBC ticker-list file: $1" >&2
    exit 1
fi
nodeJson "$1" ../cnbc/node-fetch-cnbc-yields.js
