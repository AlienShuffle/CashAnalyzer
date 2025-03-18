#!/usr/bin/bash
#
# Create a mappings of tickers to EDGAR CIK keys, used to look up more details about each fund.
# This script takes each fund ticker, looks it up in the EDGAR company_tickers_mf.json file
# and creates a JSON object that collects all the key data in on place.
#
# the current funds list is updated by a script in the mmFunCurr directory.
#
../bin/getEDGAR.sh "https://www.sec.gov/data/company_tickers_mf.json" |
jq . |
node ./node-CIK-map-update.js ../mmFunCurr/mmFunCurr-funds.txt | jq . > CIK-map.json
