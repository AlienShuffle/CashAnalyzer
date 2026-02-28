#!/usr/bin/bash
# runs a node script for collecting the latest distribution information for a given ETF ticker. This is intended to be run as part of a cron job, and is not intended to be run manually.
distFile=downloads/BOXX/BOXX-distributions.csv
if [ -f "$distFile" ]; then
    cat "$distFile" | node ./node-BOXX-distro-update.js | jq .
fi
