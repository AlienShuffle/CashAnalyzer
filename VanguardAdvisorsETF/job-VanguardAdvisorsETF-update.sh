#!/usr/bin/bash

../bin/ETF-facts-update-common-job.sh \
    --collectionScript ./collectionScript-facts.sh \
    --processScript ../lib/node-echo.js \
    "$@"

[ -f history/VanguardAdvisorsETF-facts-new.json ] &&
    cat history/VanguardAdvisorsETF-facts-new.json | ../bin/MM-update-common-job.sh \
        --accountClass Funds \
        --processScript ../lib/node-filter-yield-attrs.js \
        --pubDelay 16 --runDelay 4 "$@"

# still need to build the basic model for this, so skipping the distro update for now.
#../bin/ETF-distro-update-common-job.sh --ticker VanguardAdvisorsETF "$@"
