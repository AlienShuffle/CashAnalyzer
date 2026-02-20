#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.
../bin/MM-update-common-job.sh \
    --accountClass Funds \
    --collectionScript ./collectionScript.sh \
    --processScript ../bin/echo.js \
    --runWeekends \
    --pubDelay 16 --runDelay 4 -f "$@"
