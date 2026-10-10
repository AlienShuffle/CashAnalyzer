#!/usr/bin/bash
source ../meta.common.sh
source ../bin/nodeJobUtils.sh
IFS= read -r ticker
[ -z "$ticker" ] && exit 1
curlFile=$(mktemp) || exit 1
trap 'rm -f "$curlFile"' EXIT
curl -sSL "https://www.ssga.com/bin/v1/ssmp/fund/dividend-distribution?ticker=$ticker&country=us&language=en&role=intermediary&product=etfs" >"$curlFile" || exit 1
nodeJson "$curlFile" ./node-ssga-distro-update.js "$ticker"
