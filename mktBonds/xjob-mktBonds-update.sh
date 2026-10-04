../bin/FedInvest-update-common-job.sh \
    --collectionScript ./collect-$(basename $(pwd)).sh \
    --processScript ../lib/node-FedInvest-update.js \
    "$@"