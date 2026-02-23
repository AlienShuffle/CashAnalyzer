#!/usr/bin/bash

[ -d "history/BOXX" ] || mkdir -p "history/BOXX"

../bin/ETF-facts-update-common-job.sh "$@"

[ -f history/BOXX-facts-new.json ] && \
cat history/BOXX-facts-new.json | ../bin/MM-update-common-job.sh \
    --accountClass Funds \
    --pubDelay 18 --runDelay 4 "$@"

../bin/ETF-distro-update-common-job.sh --ticker "BOXX" "$@"