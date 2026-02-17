#!/usr/bin/bash
# do a yield update and collect the latest links for ETFs distributions.

[ -d "history/BOXX" ] || mkdir -p "history/BOXX"

# update the yield and nav.
../bin/MM-update-common-job.sh \
    --accountClass Funds \
    --pubDelay 18 --runDelay 4 "$@"

# update distribution links.
../bin/ETF-distro-update-common-job.sh --ticker "BOXX" "$@"

# update facts files.
cat history/BOXX-rate-new.json |
    ../bin/ETF-facts-update-common-job.sh --nodeArg "BOXX" "$@"