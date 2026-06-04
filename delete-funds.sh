#!/usr/bin/bash
#
# Pull the driver JSON file from the BlackRock website with detailed MM fund info.
#

for i in PVOXX; do
    echo "Deleting $i from MM Optimizer universe."
    rm -ir ./BlackRock/history/$i
    rm -i ./EDGAR-e-MFP-parse/tickers/$i.json
    rm -i ./EDGAR-e-MFP-parse/tax/$i-taxation.json
    rm -ir ~/cloudflare/public/MM/$i
    rm -ir ~/cloudflare/public/EDGAR/$i
    rm -ir ~/cloudflare/public/Funds/$i
done
