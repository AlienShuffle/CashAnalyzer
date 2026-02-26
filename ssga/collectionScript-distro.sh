#!/usr/bin/bash
source ../meta.$(hostname).sh
IFS= read -r ticker
[ -z "$ticker" ] && exit 1
curl -sSL "https://www.ssga.com/bin/v1/ssmp/fund/dividend-distribution?ticker=$ticker&country=us&language=en&role=intermediary&product=etfs" |
    # tee divs-in.json |
    node ./node-ssga-distro-update.js $ticker |
    jq .
