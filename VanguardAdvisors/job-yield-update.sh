#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.
cat ./VanguardETF-funds.txt |
    ../bin/MM-update-common-job.sh \
        --accountClass Funds \
        --collectionScript ./collectionScript.sh \
        --processScript ../bin/echo.js \
        --runWeekends \
        --pubDelay 18 --runDelay 4 -f "$@"
