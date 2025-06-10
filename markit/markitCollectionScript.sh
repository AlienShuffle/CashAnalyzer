#!/usr/bin/bash
#
# Pull a result from EDGAR with the agent key set so we work okay.
#
# computer-specific configurations.
source ../meta.$(hostname).sh

token=$(curl --header 'Content-Type: application/json' \
    --header "$curlAgentHeader" \
    -sSL "https://www.reuters.com/service/graphql" \
    --data @token-query.json |
    jq -r '.data.getModToken.accessToken')

(
    firstRow=true
    echo "{"
    # note, this cut is reading from stdin and expects a csv list of fund ticker, ticker, names to drive the queries.
    while IFS= read -r ticker; do
        [ "$firstRow" = "false" ] && echo ","
        echo "\"${ticker}\": "

        xid=$(curl -sSL \
            "https://content.markitcdn.com/api.markitondemand.com/apiman-gateway/MOD/chartworks-xref/1.0/xref/exact?inputs=%5B%7B%22symbol%22%3A%22${ticker}.O%22%7D%5D&access_token=${token}" |
            jq -r '.data.items[0].xid')

        sed -s "s/XXxidXX/${xid}/" ./content-template.json >content-xid.json
        curl -sSL "https://content.markitcdn.com/api.markitondemand.com/apiman-gateway/MOD/chartworks-data/1.0/chartapi/series?access_token=${token}" \
            --header "$curlAgentHeader" \
            --header 'Content-Type: application/json' \
            --data @content-xid.json | node ./node-parse-markit-file.js
        firstRow=false
    done
    echo "}"
)
rm -f content-xid.json
