#!/usr/bin/bash
#
# Pull a today's summary yields report for feeding into the processor.
#
# the current funds list is updated by a script in the mmFunCurr directory.
#
../bin/getEDGAR.sh "https://www.sec.gov/data/company_tickers_mf.json" |
jq . |
node ./node-CIK-map-update.js ../mmFunCurr/mmFunCurr-funds.txt | jq . > CIK-map.json
