#!/usr/bin/bash
source ../meta.common.sh
export BOND_SOURCE_NAME=fedBonds
export BOND_REPORT_PREFIX=fed
export BOND_REPORT_SOURCE=FedInvest
export BOND_SETTLEMENT_DAYS=0
export BOND_COLLECTION_SCRIPT=../fedBonds/collect-fedBonds.sh
export BOND_PROCESS_SCRIPT=../fedBonds/node-fedBonds-update.mjs
export BOND_TIPS_META_FILE="$cloudFlareHome/Treasuries/TIPSmeta.csv"

if [ "${BOND_DAILY_ONLY:-false}" != true ]; then
    node ./publish-daily.mjs "--published=$cloudFlareHome/Treasuries/fedBonds/daily" --archive-only || exit $?
    export BOND_DAILY_DIR="$PWD/history/daily"
else
    unset BOND_DAILY_DIR
fi

bash ../mktBonds/job-mktBonds-update.sh "$@" || exit $?
bash ../mktBonds/job-mktTips-update.sh "$@" || exit $?

if [ "${BOND_DAILY_ONLY:-false}" != true ]; then
    node ./publish-daily.mjs "--published=$cloudFlareHome/Treasuries/fedBonds/daily" || exit $?
fi
